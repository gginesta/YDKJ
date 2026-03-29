import type { Server as SocketIOServer } from 'socket.io';
import type { GameRoom, MultipleChoiceQuestion } from '../../types/game';
import type { ClientToServerEvents, ServerToClientEvents, GameSnapshot } from '../../types/socket';
import { GameState } from '../../types/game';
import { calculateScore, updateStreak, getStreakBonus, assignQuestionValues, getLeadingPlayer } from './scoring';
import { saveGameResult, hashPlayerGroup, getSeenQuestionIds, recordSeenQuestions, resetSeenQuestions } from '../db';
import seedQuestionsData from '../ai/seed-questions.json';

type AppIO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

interface SeedQuestion {
  id: string;
  type: string;
  category: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  hostIntro: string;
  hostCorrect: string;
  hostWrong: string;
  hostTimeout: string;
}

interface PlayerAnswer {
  playerId: string;
  answerIndex: number;
  timestamp: number;
}

// Phase durations in milliseconds
const DURATIONS = {
  GAME_STARTING: 5000,
  QUESTION_INTRO: 6000,
  QUESTION_ACTIVE: 20000,
  QUESTION_REVEAL: 5000,
  SCORES_UPDATE: 4000,
  ROUND_TRANSITION: 5000,
  GAME_OVER: 15000,
  WIMP_TIMER: 10000,
};

const QUESTIONS_PER_ROUND = 5;
const TOTAL_QUESTIONS = 10;

export class GameEngine {
  private io: AppIO;
  private room: GameRoom;
  private roomCode: string;
  private questions: MultipleChoiceQuestion[] = [];
  private currentAnswers: Map<string, PlayerAnswer> = new Map();
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private questionStartTime: number = 0;
  private questionTimeLimit: number = DURATIONS.QUESTION_ACTIVE;
  private destroyed: boolean = false;
  private wimpMode: boolean = false;

  constructor(io: AppIO, room: GameRoom, roomCode: string) {
    this.io = io;
    this.room = room;
    this.roomCode = roomCode;
  }

  /**
   * Start the game. Loads questions and begins the state machine.
   */
  start(): void {
    this.loadQuestions();
    this.room.state = GameState.GAME_STARTING;
    this.room.round = 1;
    this.room.questionIndex = 0;
    this.room.startedAt = Date.now();

    // Reset all players
    for (const player of this.room.players) {
      player.money = 0;
      player.streak = 0;
      player.answers = [];
    }

    this.emit('game_starting', {
      hostScript: this.getStartingScript(),
    });

    this.scheduleNext(DURATIONS.GAME_STARTING, () => this.startQuestionIntro());
  }

  /**
   * Handle a player submitting an answer.
   */
  submitAnswer(playerId: string, questionId: string, answerIndex: number, timestamp: number): void {
    if (this.room.state !== GameState.QUESTION_ACTIVE) return;
    if (this.currentAnswers.has(playerId)) return; // Already answered

    const currentQ = this.questions[this.room.questionIndex];
    if (!currentQ || currentQ.id !== questionId) return;

    this.currentAnswers.set(playerId, { playerId, answerIndex, timestamp });

    // Broadcast that this player has answered (no reveal)
    this.emit('answer_received', { playerId });

    // If all connected players have answered, advance immediately
    const connectedPlayers = this.room.players.filter((p) => p.connected);
    if (this.currentAnswers.size >= connectedPlayers.length) {
      this.clearTimer();
      this.revealAnswer();
    }
  }

  /**
   * Clean up all timers and state.
   */
  destroy(): void {
    this.destroyed = true;
    this.clearTimer();
  }

  /**
   * Reset game for "play again" — keeps players, resets scores.
   */
  resetForPlayAgain(): void {
    this.destroy();
    this.destroyed = false;
    this.room.state = GameState.LOBBY;
    this.room.round = 1;
    this.room.questionIndex = 0;
    this.room.questions = [];
    this.room.startedAt = undefined;
    this.currentAnswers.clear();

    for (const player of this.room.players) {
      player.money = 0;
      player.streak = 0;
      player.answers = [];
    }
  }

  /**
   * Remap a player's ID in the current answers map (used on reconnection).
   */
  remapPlayerId(oldId: string, newId: string): void {
    const answer = this.currentAnswers.get(oldId);
    if (answer) {
      this.currentAnswers.delete(oldId);
      answer.playerId = newId;
      this.currentAnswers.set(newId, answer);
    }
  }

  /**
   * Get a snapshot of the current game state for a reconnecting client.
   */
  getGameSnapshot(): GameSnapshot {
    const q = this.questions[this.room.questionIndex];
    const isActive = this.room.state === GameState.QUESTION_ACTIVE;
    const isReveal = this.room.state === GameState.QUESTION_REVEAL;

    const scores = this.room.players
      .map((p) => ({ playerId: p.id, name: p.name, money: p.money }))
      .sort((a, b) => b.money - a.money);

    // Build question data appropriate for the current phase
    let currentQuestion: Record<string, unknown> | null = null;
    if (q && this.room.state !== GameState.LOBBY && this.room.state !== GameState.GAME_OVER) {
      currentQuestion = {
        id: q.id,
        type: q.type,
        category: q.category,
        value: q.value,
        timeLimit: q.timeLimit,
        questionIndex: this.room.questionIndex,
        totalQuestions: TOTAL_QUESTIONS,
        round: this.room.round,
        // Only include answers if the question is active or being revealed
        ...(isActive || isReveal
          ? { prompt: q.prompt, choices: q.choices }
          : {}),
      };
    }

    // Calculate remaining time for active questions
    let questionTimeRemainingMs: number | null = null;
    if (isActive) {
      const elapsed = Date.now() - this.questionStartTime;
      questionTimeRemainingMs = Math.max(0, this.questionTimeLimit - elapsed);
    }

    return {
      gameState: this.room.state,
      currentQuestion,
      questionTimeRemainingMs,
      answeredPlayerIds: Array.from(this.currentAnswers.keys()),
      scores,
      currentRound: this.room.round,
      questionIndex: this.room.questionIndex,
      totalQuestions: TOTAL_QUESTIONS,
      hostDialogue: null,
      correctAnswerIndex: isReveal ? q?.correctIndex ?? null : null,
      playerResults: [],
      finalScores: this.room.state === GameState.GAME_OVER ? scores : [],
      gameOverHostScript: null,
    };
  }

  // ============================================================
  // Private — State Machine
  // ============================================================

  private loadQuestions(): void {
    const seed = seedQuestionsData as SeedQuestion[];

    // Deduplicate: filter out questions this player group has already seen
    const playerNames = this.room.players.map((p) => p.name);
    const groupHash = hashPlayerGroup(playerNames);
    let seenIds = getSeenQuestionIds(groupHash);

    let pool = seed.filter((q) => !seenIds.includes(q.id));

    // If not enough unseen questions, reset and use full pool
    if (pool.length < TOTAL_QUESTIONS) {
      resetSeenQuestions(groupHash);
      seenIds = [];
      pool = [...seed];
    }

    // Shuffle and pick TOTAL_QUESTIONS
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, TOTAL_QUESTIONS);

    // Record the selected questions as seen
    recordSeenQuestions(groupHash, selected.map((q) => q.id));

    const round1Values = assignQuestionValues(1);
    const round2Values = assignQuestionValues(2);

    this.questions = selected.map((q, i): MultipleChoiceQuestion => {
      const round = i < QUESTIONS_PER_ROUND ? 1 : 2;
      const indexInRound = i < QUESTIONS_PER_ROUND ? i : i - QUESTIONS_PER_ROUND;
      const values = round === 1 ? round1Values : round2Values;

      return {
        id: q.id,
        type: 'multiple_choice',
        category: q.category,
        prompt: q.prompt,
        choices: q.choices,
        correctIndex: q.correctIndex,
        value: values[indexInRound],
        timeLimit: DURATIONS.QUESTION_ACTIVE / 1000,
        hostIntro: q.hostIntro,
        hostCorrect: q.hostCorrect,
        hostWrong: q.hostWrong,
        hostTimeout: q.hostTimeout,
      };
    });

    this.room.questions = this.questions;
  }

  private startQuestionIntro(): void {
    if (this.destroyed) return;

    const q = this.questions[this.room.questionIndex];
    if (!q) {
      this.endGame();
      return;
    }

    this.room.state = GameState.QUESTION_INTRO;
    this.currentAnswers.clear();
    this.wimpMode = false;

    // Send question WITHOUT answers (redacted)
    this.emit('question_intro', {
      question: {
        id: q.id,
        type: q.type,
        category: q.category,
        value: q.value,
        timeLimit: q.timeLimit,
        questionIndex: this.room.questionIndex,
        totalQuestions: TOTAL_QUESTIONS,
        round: this.room.round,
      },
      hostScript: q.hostIntro,
    });

    this.scheduleNext(DURATIONS.QUESTION_INTRO, () => this.startQuestionActive());
  }

  private startQuestionActive(): void {
    if (this.destroyed) return;

    const q = this.questions[this.room.questionIndex];
    if (!q) return;

    this.room.state = GameState.QUESTION_ACTIVE;
    this.questionStartTime = Date.now();
    this.questionTimeLimit = DURATIONS.QUESTION_ACTIVE;

    // Send full question with answers
    this.emit('question_active', {
      question: {
        id: q.id,
        type: q.type,
        category: q.category,
        value: q.value,
        prompt: q.prompt,
        choices: q.choices,
        timeLimit: q.timeLimit,
        questionIndex: this.room.questionIndex,
        totalQuestions: TOTAL_QUESTIONS,
        round: this.room.round,
      },
      timeLimit: this.questionTimeLimit / 1000,
    });

    this.scheduleNext(this.questionTimeLimit, () => this.onQuestionTimeout());
  }

  private onQuestionTimeout(): void {
    if (this.destroyed) return;

    // Check if nobody answered — "Don't Be a Wimp"
    if (this.currentAnswers.size === 0 && !this.wimpMode) {
      this.triggerWimpMode();
      return;
    }

    this.revealAnswer();
  }

  private triggerWimpMode(): void {
    this.wimpMode = true;
    const leader = getLeadingPlayer(this.room.players.filter((p) => p.connected));
    const q = this.questions[this.room.questionIndex];

    const wimpScript = leader
      ? `Hey ${leader.name}, you're sitting on $${leader.money.toLocaleString()} and you can't even take a guess? Don't be a wimp!`
      : "Nobody? Really? Come on, take a guess!";

    // Re-send question_active with shorter timer
    this.emit('question_active', {
      question: {
        id: q.id,
        type: q.type,
        category: q.category,
        value: q.value,
        prompt: q.prompt,
        choices: q.choices,
        timeLimit: DURATIONS.WIMP_TIMER / 1000,
        questionIndex: this.room.questionIndex,
        totalQuestions: TOTAL_QUESTIONS,
        round: this.room.round,
        hostScript: wimpScript,
      },
      timeLimit: DURATIONS.WIMP_TIMER / 1000,
    });

    this.questionStartTime = Date.now();
    this.questionTimeLimit = DURATIONS.WIMP_TIMER;

    this.scheduleNext(DURATIONS.WIMP_TIMER, () => this.revealAnswer());
  }

  private revealAnswer(): void {
    if (this.destroyed) return;

    const q = this.questions[this.room.questionIndex];
    if (!q) return;

    this.room.state = GameState.QUESTION_REVEAL;

    // Score each player
    const playerResults: {
      playerId: string;
      name: string;
      isCorrect: boolean;
      moneyEarned: number;
      speedBonus: number;
      selectedIndex?: number;
    }[] = [];

    for (const player of this.room.players) {
      const answer = this.currentAnswers.get(player.id);
      const isCorrect = answer ? answer.answerIndex === q.correctIndex : false;
      const didAnswer = !!answer;

      let moneyEarned = 0;
      let speedBonus = 0;

      if (didAnswer) {
        const timeRemaining = Math.max(0, this.questionTimeLimit - (answer!.timestamp - this.questionStartTime));
        const result = calculateScore(q.value, isCorrect, timeRemaining, this.questionTimeLimit);
        moneyEarned = result.total;
        speedBonus = result.speedBonus;
      }

      // Update player
      player.money += moneyEarned;
      player.streak = updateStreak(player.streak, isCorrect);

      // Streak bonus — only count answers from current game (this.questions.length worth)
      const currentGameAnswers = player.answers.slice(-(this.room.questionIndex));
      const correctCount = currentGameAnswers.filter((a) => a.isCorrect).length + (isCorrect ? 1 : 0);
      const streakBonus = getStreakBonus(player.streak, correctCount);
      if (streakBonus > 0) {
        player.money += streakBonus;
        moneyEarned += streakBonus;
      }

      player.answers.push({
        questionId: q.id,
        questionType: q.type,
        answeredAt: answer?.timestamp || 0,
        timeToAnswer: answer ? (answer.timestamp - this.questionStartTime) / 1000 : 0,
        isCorrect,
        selectedIndex: answer?.answerIndex,
        moneyEarned,
        speedBonus,
      });

      playerResults.push({
        playerId: player.id,
        name: player.name,
        isCorrect,
        moneyEarned,
        speedBonus,
        selectedIndex: answer?.answerIndex,
      });
    }

    // Build host script for reveal
    const correctPlayers = playerResults.filter((r) => r.isCorrect);
    const wrongPlayers = playerResults.filter((r) => !r.isCorrect && r.selectedIndex !== undefined);
    let hostScript: string;

    if (correctPlayers.length === 0) {
      hostScript = q.hostTimeout;
    } else if (wrongPlayers.length === 0) {
      hostScript = q.hostCorrect + " Everyone got it!";
    } else {
      hostScript = correctPlayers.length > wrongPlayers.length ? q.hostCorrect : q.hostWrong;
    }

    this.emit('question_reveal', {
      correctAnswer: q.correctIndex,
      playerResults,
      hostScript,
    });

    this.scheduleNext(DURATIONS.QUESTION_REVEAL, () => this.showScores());
  }

  private showScores(): void {
    if (this.destroyed) return;

    this.room.state = GameState.SCORES_UPDATE;

    const scores = this.room.players
      .map((p) => ({ playerId: p.id, name: p.name, money: p.money }))
      .sort((a, b) => b.money - a.money);

    this.emit('scores_update', { scores });

    this.scheduleNext(DURATIONS.SCORES_UPDATE, () => this.advanceToNextQuestion());
  }

  private advanceToNextQuestion(): void {
    if (this.destroyed) return;

    this.room.questionIndex++;

    // Check if we need a round transition
    if (this.room.questionIndex === QUESTIONS_PER_ROUND && this.room.round === 1) {
      this.room.round = 2;
      this.room.state = GameState.ROUND_TRANSITION;

      this.emit('round_transition', {
        round: 2,
        hostScript: "Round 2! All values are DOUBLED! Things are about to get serious.",
      });

      this.scheduleNext(DURATIONS.ROUND_TRANSITION, () => this.startQuestionIntro());
      return;
    }

    // Check if game is over
    if (this.room.questionIndex >= TOTAL_QUESTIONS) {
      this.endGame();
      return;
    }

    // Next question
    this.startQuestionIntro();
  }

  private endGame(): void {
    if (this.destroyed) return;

    this.room.state = GameState.GAME_OVER;

    const finalScores = this.room.players
      .map((p) => ({ playerId: p.id, name: p.name, money: p.money }))
      .sort((a, b) => b.money - a.money);

    const winner = finalScores[0];
    const loser = finalScores[finalScores.length - 1];

    let hostScript = `And that's the game! `;
    if (winner && loser && finalScores.length > 1) {
      hostScript += `${winner.name} takes it home with $${winner.money.toLocaleString()}! `;
      if (loser.money < 0) {
        hostScript += `And ${loser.name}... you owe us $${Math.abs(loser.money).toLocaleString()}. We accept cash and tears.`;
      } else {
        hostScript += `Better luck next time, ${loser.name}.`;
      }
    } else if (winner) {
      hostScript += `${winner.name} wins with $${winner.money.toLocaleString()}!`;
    }

    this.emit('game_over', {
      finalScores,
      hostScript,
    });

    // Save to database
    this.saveResults(finalScores);
  }

  private async saveResults(
    finalScores: { playerId: string; name: string; money: number }[]
  ): Promise<void> {
    try {
      const playerNames = this.room.players.map((p) => p.name);
      const scoresObj: Record<string, number> = {};
      for (const s of finalScores) {
        scoresObj[s.name] = s.money;
      }

      saveGameResult({
        room_code: this.roomCode,
        player_names: JSON.stringify(playerNames),
        final_scores: JSON.stringify(scoresObj),
        winner_name: finalScores[0]?.name || 'Unknown',
        question_count: TOTAL_QUESTIONS,
        duration_seconds: Math.round((Date.now() - (this.room.startedAt || Date.now())) / 1000),
        theme: this.room.theme,
      });
    } catch (err) {
      console.error('[GameEngine] Failed to save results:', err);
    }
  }

  // ============================================================
  // Private — Helpers
  // ============================================================

  private emit(event: string, data: unknown): void {
    if (this.destroyed) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.io.to(this.roomCode) as any).emit(event, data);
  }

  private scheduleNext(delayMs: number, callback: () => void): void {
    this.clearTimer();
    this.phaseTimer = setTimeout(() => {
      if (!this.destroyed) callback();
    }, delayMs);
  }

  private clearTimer(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  private getStartingScript(): string {
    const names = this.room.players.map((p) => p.name);
    if (names.length === 2) {
      return `Welcome to You Don't Know Jack! Tonight it's ${names[0]} versus ${names[1]}. Let's see who's actually smart and who's been faking it.`;
    }
    const last = names.pop();
    return `Welcome to You Don't Know Jack! We've got ${names.join(', ')}, and ${last}. ${this.room.players.length} players, zero excuses. Let's go!`;
  }
}
