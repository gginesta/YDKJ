import type { Server as SocketIOServer } from 'socket.io';
import type { GameRoom, MultipleChoiceQuestion } from '../../types/game';
import type { ClientToServerEvents, ServerToClientEvents, GameSnapshot } from '../../types/socket';
import { GameState } from '../../types/game';
import { calculateScore, updateStreak, getStreakBonus, getLeadingPlayer } from './scoring';
import { saveGameResult } from '../db';
import {
  generateGameQuestions,
  generateRoundTransitionCommentary,
  generateGameOutro,
} from '../ai/question-pipeline';
import type { CommentaryContext } from '../ai/prompts/host-commentary';
import { generateSpeechWithTimeout, isTTSAvailable } from '../voice/elevenlabs-client';

type AppIO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

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

  // AI-generated content
  private gameIntro: string = '';
  private gameOutro: string = '';
  private questionSource: 'ai' | 'seed' = 'seed';
  private recentHostLines: string[] = [];

  constructor(io: AppIO, room: GameRoom, roomCode: string) {
    this.io = io;
    this.room = room;
    this.roomCode = roomCode;
  }

  /**
   * Start the game. Generates questions (AI or seed) and begins the state machine.
   */
  async start(): Promise<void> {
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

    // Generate questions (AI with seed fallback)
    const playerNames = this.room.players.map((p) => p.name);
    const result = await generateGameQuestions(playerNames, this.room.theme);

    this.questions = result.questions;
    this.gameIntro = result.gameIntro;
    this.gameOutro = result.gameOutro;
    this.questionSource = result.source;
    this.room.questions = this.questions;

    console.log(`[GameEngine] Loaded ${this.questions.length} questions (source: ${this.questionSource})`);

    if (this.destroyed) return; // Game was cancelled during generation

    // Generate intro audio (non-blocking — game starts regardless)
    const introAudio = await this.generateAudio(this.gameIntro);

    if (this.destroyed) return;

    this.emit('game_starting', {
      hostScript: this.gameIntro,
      audioUrl: introAudio ? `data:audio/mpeg;base64,${introAudio}` : undefined,
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
    this.recentHostLines = [];

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
        ...(isActive || isReveal ? { prompt: q.prompt, choices: q.choices } : {}),
      };
    }

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

  private async startQuestionIntro(): Promise<void> {
    if (this.destroyed) return;

    const q = this.questions[this.room.questionIndex];
    if (!q) {
      this.endGame();
      return;
    }

    this.room.state = GameState.QUESTION_INTRO;
    this.currentAnswers.clear();
    this.wimpMode = false;

    // Generate audio for the host intro (with timeout so we don't block the game)
    const audio = await this.generateAudio(q.hostIntro);

    if (this.destroyed) return;

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
      audioUrl: audio ? `data:audio/mpeg;base64,${audio}` : undefined,
    });

    this.trackHostLine(q.hostIntro);
    this.scheduleNext(DURATIONS.QUESTION_INTRO, () => this.startQuestionActive());
  }

  private startQuestionActive(): void {
    if (this.destroyed) return;

    const q = this.questions[this.room.questionIndex];
    if (!q) return;

    this.room.state = GameState.QUESTION_ACTIVE;
    this.questionStartTime = Date.now();
    this.questionTimeLimit = DURATIONS.QUESTION_ACTIVE;

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

  private async revealAnswer(): Promise<void> {
    if (this.destroyed) return;

    const q = this.questions[this.room.questionIndex];
    if (!q) return;

    this.room.state = GameState.QUESTION_REVEAL;

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

      player.money += moneyEarned;
      player.streak = updateStreak(player.streak, isCorrect);

      // Streak bonus — only count answers from current game
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

    this.trackHostLine(hostScript);

    // Generate reveal audio in background — don't block scoring
    const revealAudio = await this.generateAudio(hostScript);

    if (this.destroyed) return;

    this.emit('question_reveal', {
      correctAnswer: q.correctIndex,
      playerResults,
      hostScript,
      audioUrl: revealAudio ? `data:audio/mpeg;base64,${revealAudio}` : undefined,
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

  private async advanceToNextQuestion(): Promise<void> {
    if (this.destroyed) return;

    this.room.questionIndex++;

    // Round transition
    if (this.room.questionIndex === QUESTIONS_PER_ROUND && this.room.round === 1) {
      this.room.round = 2;
      this.room.state = GameState.ROUND_TRANSITION;

      // Generate AI commentary for round transition
      const hostScript = await this.generateRoundTransition();
      this.trackHostLine(hostScript);

      const transAudio = await this.generateAudio(hostScript);

      if (this.destroyed) return;

      this.emit('round_transition', {
        round: 2,
        hostScript,
        audioUrl: transAudio ? `data:audio/mpeg;base64,${transAudio}` : undefined,
      });

      this.scheduleNext(DURATIONS.ROUND_TRANSITION, () => this.startQuestionIntro());
      return;
    }

    // Game over
    if (this.room.questionIndex >= TOTAL_QUESTIONS) {
      this.endGame();
      return;
    }

    // Next question
    this.startQuestionIntro();
  }

  private async endGame(): Promise<void> {
    if (this.destroyed) return;

    this.room.state = GameState.GAME_OVER;

    const finalScores = this.room.players
      .map((p) => ({ playerId: p.id, name: p.name, money: p.money }))
      .sort((a, b) => b.money - a.money);

    const winner = finalScores[0];
    const loser = finalScores[finalScores.length - 1];

    // Generate AI outro
    let hostScript: string;
    if (winner && loser && finalScores.length > 1) {
      hostScript = await generateGameOutro(winner, loser, finalScores, this.gameOutro);
    } else if (winner) {
      hostScript = `${winner.name} wins with $${winner.money.toLocaleString()}!`;
    } else {
      hostScript = "And that's the game!";
    }

    const outroAudio = await this.generateAudio(hostScript);

    if (this.destroyed) return;

    this.emit('game_over', {
      finalScores,
      hostScript,
      audioUrl: outroAudio ? `data:audio/mpeg;base64,${outroAudio}` : undefined,
    });

    this.saveResults(finalScores);
  }

  // ============================================================
  // Private — AI Commentary Helpers
  // ============================================================

  private buildCommentaryContext(): CommentaryContext {
    return {
      players: this.room.players.map((p) => {
        const lastAnswer = p.answers.length > 0 ? p.answers[p.answers.length - 1] : null;
        return {
          name: p.name,
          money: p.money,
          streak: p.streak,
          lastAnswerCorrect: lastAnswer ? lastAnswer.isCorrect : null,
          connected: p.connected,
        };
      }),
      questionNumber: this.room.questionIndex + 1,
      totalQuestions: TOTAL_QUESTIONS,
      round: this.room.round,
      previousHostLines: this.recentHostLines.slice(-3),
    };
  }

  private async generateRoundTransition(): Promise<string> {
    try {
      return await generateRoundTransitionCommentary(this.buildCommentaryContext());
    } catch {
      return "Round 2! All values are DOUBLED! Things are about to get serious.";
    }
  }

  /**
   * Generate TTS audio for a host line. Returns base64 or null.
   */
  private async generateAudio(text: string): Promise<string | null> {
    if (!isTTSAvailable()) return null;
    try {
      return await generateSpeechWithTimeout(text, 4000);
    } catch {
      return null;
    }
  }

  private trackHostLine(line: string): void {
    this.recentHostLines.push(line);
    if (this.recentHostLines.length > 5) {
      this.recentHostLines.shift();
    }
  }

  // ============================================================
  // Private — Persistence
  // ============================================================

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
  // Private — Utilities
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
}
