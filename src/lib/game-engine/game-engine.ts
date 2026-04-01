import type { Server as SocketIOServer } from 'socket.io';
import type {
  GameRoom,
  Player,
  MultipleChoiceQuestion,
  DisOrDatQuestion,
  GibberishQuestion,
  ThreeWayQuestion,
  JackAttackRound,
} from '../../types/game';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/socket';
import { GameState } from '../../types/game';
import {
  calculateScore,
  updateStreak,
  getStreakBonus,
  assignQuestionValues,
  getLeadingPlayer,
} from './scoring';
import {
  saveGameResult,
  hashPlayerGroup,
  getSeenQuestionIds,
  recordSeenQuestions,
  resetSeenQuestions,
} from '../db';
import seedMCData from '../ai/seed-questions.json';
import seedGibberishData from '../ai/seed-gibberish.json';
import seedDisOrDatData from '../ai/seed-dis-or-dat.json';
import seedThreeWayData from '../ai/seed-three-way.json';
import seedJackAttackData from '../ai/seed-jack-attack.json';

type AppIO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

type AnyQuestion =
  | MultipleChoiceQuestion
  | DisOrDatQuestion
  | GibberishQuestion
  | ThreeWayQuestion;

interface PlayerAnswer {
  playerId: string;
  answerIndex: number;
  timestamp: number;
}

interface SeedMC {
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

interface SeedGibberish {
  id: string;
  type: string;
  category: string;
  gibberishPhrase: string;
  choices: string[];
  correctIndex: number;
  hint?: string;
  hostIntro: string;
  hostCorrect: string;
  hostWrong: string;
  hostTimeout: string;
}

interface SeedDisOrDat {
  id: string;
  type: string;
  category: string;
  categoryA: string;
  categoryB: string;
  items: { text: string; correct: 'A' | 'B' }[];
  hostIntro: string;
  hostCorrect: string;
  hostWrong: string;
  hostTimeout: string;
}

interface SeedThreeWay {
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

interface SeedJackAttack {
  id: string;
  theme: string;
  clue: string;
  pairs: { answer: string; isCorrect: boolean }[];
  matchValue: number;
  penaltyValue: number;
  hostIntro: string;
}

// Phase durations in milliseconds
const DURATIONS = {
  GAME_STARTING: 5000,
  QUESTION_INTRO: 6000,
  QUESTION_ACTIVE: 20000,
  DIS_OR_DAT_ACTIVE: 42000, // 6s per item × 7 items
  QUESTION_REVEAL: 5000,
  SCORES_UPDATE: 4000,
  ROUND_TRANSITION: 5000,
  JACK_ATTACK_INTRO: 6000,
  JACK_ATTACK_WORD_INTERVAL: 3500, // 3.5s per word
  JACK_ATTACK_RESULTS: 6000,
  GAME_OVER: 15000,
  WIMP_TIMER: 10000,
};

const QUESTIONS_PER_ROUND = 5;
const TOTAL_QUESTIONS = 10;

// Question type schedule — defines the type for each of the 10 questions
// Round 1 (indices 0-4): mix of MC, ThreeWay, Gibberish
// Round 2 (indices 5-9): mix of MC, DisOrDat, Gibberish
const QUESTION_TYPE_SCHEDULE = [
  'multiple_choice', // Q1
  'multiple_choice', // Q2
  'three_way',       // Q3
  'multiple_choice', // Q4
  'gibberish',       // Q5
  'multiple_choice', // Q6
  'dis_or_dat',      // Q7
  'multiple_choice', // Q8
  'three_way',       // Q9
  'dis_or_dat',      // Q10
] as const;

export class GameEngine {
  private io: AppIO;
  private room: GameRoom;
  private roomCode: string;
  private questions: AnyQuestion[] = [];
  private currentAnswers: Map<string, PlayerAnswer> = new Map();
  private disOrDatAnswers: Map<string, ('A' | 'B' | null)[]> = new Map();
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private questionStartTime: number = 0;
  private questionTimeLimit: number = DURATIONS.QUESTION_ACTIVE;
  private destroyed: boolean = false;
  private wimpMode: boolean = false;

  // Jack Attack state
  private jackAttackData: SeedJackAttack | null = null;
  private jackAttackWordIndex: number = 0;
  private jackAttackCurrentWordId: string = '';
  private jackAttackCurrentIsCorrect: boolean = false;
  private jackAttackWordActive: boolean = false;
  private buzzedOnCurrentWord: Set<string> = new Set();

  constructor(io: AppIO, room: GameRoom, roomCode: string) {
    this.io = io;
    this.room = room;
    this.roomCode = roomCode;
  }

  // ============================================================
  // Public API
  // ============================================================

  start(): void {
    this.loadQuestions();
    this.room.state = GameState.GAME_STARTING;
    this.room.round = 1;
    this.room.questionIndex = 0;
    this.room.startedAt = Date.now();

    for (const player of this.room.players) {
      player.money = 0;
      player.streak = 0;
      player.answers = [];
    }

    this.emit('game_starting', { hostScript: this.getStartingScript() });
    this.scheduleNext(DURATIONS.GAME_STARTING, () => this.startQuestionIntro());
  }

  submitAnswer(
    playerId: string,
    questionId: string,
    answerIndex: number,
    timestamp: number
  ): void {
    if (this.room.state !== GameState.QUESTION_ACTIVE) return;
    if (this.currentAnswers.has(playerId)) return;

    const currentQ = this.questions[this.room.questionIndex];
    if (!currentQ || currentQ.id !== questionId) return;
    if (currentQ.type === 'dis_or_dat') return; // wrong event for this type

    this.currentAnswers.set(playerId, { playerId, answerIndex, timestamp });
    this.emit('answer_received', { playerId });

    const connectedPlayers = this.room.players.filter((p) => p.connected);
    if (this.currentAnswers.size >= connectedPlayers.length) {
      this.clearTimer();
      this.revealAnswer();
    }
  }

  submitDisOrDat(
    playerId: string,
    questionId: string,
    answers: ('A' | 'B' | null)[]
  ): void {
    if (this.room.state !== GameState.QUESTION_ACTIVE) return;
    if (this.disOrDatAnswers.has(playerId)) return;

    const currentQ = this.questions[this.room.questionIndex];
    if (!currentQ || currentQ.id !== questionId || currentQ.type !== 'dis_or_dat') return;

    this.disOrDatAnswers.set(playerId, answers);
    this.emit('answer_received', { playerId });

    const connectedPlayers = this.room.players.filter((p) => p.connected);
    if (this.disOrDatAnswers.size >= connectedPlayers.length) {
      this.clearTimer();
      this.revealAnswer();
    }
  }

  submitJackAttackBuzz(playerId: string, wordId: string): void {
    if (this.room.state !== GameState.JACK_ATTACK_ACTIVE) return;
    if (!this.jackAttackWordActive) return;
    if (wordId !== this.jackAttackCurrentWordId) return;
    if (this.buzzedOnCurrentWord.has(playerId)) return; // already buzzed this word

    this.buzzedOnCurrentWord.add(playerId);
    const isCorrect = this.jackAttackCurrentIsCorrect;
    const data = this.jackAttackData!;
    const moneyDelta = isCorrect ? data.matchValue : -data.penaltyValue;

    const player = this.room.players.find((p) => p.id === playerId);
    if (player) player.money += moneyDelta;

    this.emit('jack_attack_buzz_result', { playerId, wordId, correct: isCorrect, moneyDelta });
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimer();
  }

  resetForPlayAgain(): void {
    this.destroy();
    this.destroyed = false;
    this.room.state = GameState.LOBBY;
    this.room.round = 1;
    this.room.questionIndex = 0;
    this.room.questions = [];
    this.room.startedAt = undefined;
    this.currentAnswers.clear();
    this.disOrDatAnswers.clear();

    for (const player of this.room.players) {
      player.money = 0;
      player.streak = 0;
      player.answers = [];
    }
  }

  markPlayerDisconnected(socketId: string): void {
    const player = this.room.players.find((p) => p.id === socketId);
    if (player) player.connected = false;
  }

  // ============================================================
  // Private — Question Loading
  // ============================================================

  private loadQuestions(): void {
    const playerNames = this.room.players.map((p) => p.name);
    const groupHash = hashPlayerGroup(playerNames);
    let seenIds = getSeenQuestionIds(groupHash);

    const mcPool = (seedMCData as SeedMC[]).filter((q) => !seenIds.includes(q.id));
    const gibberishPool = (seedGibberishData as SeedGibberish[]).filter(
      (q) => !seenIds.includes(q.id)
    );
    const disOrDatPool = (seedDisOrDatData as SeedDisOrDat[]).filter(
      (q) => !seenIds.includes(q.id)
    );
    const threeWayPool = (seedThreeWayData as SeedThreeWay[]).filter(
      (q) => !seenIds.includes(q.id)
    );

    // Shuffle all pools
    const shuffle = <T>(arr: T[]): T[] => arr.sort(() => Math.random() - 0.5);
    const mcShuffled = shuffle([...mcPool]);
    const gibberishShuffled = shuffle([...gibberishPool]);
    const disOrDatShuffled = shuffle([...disOrDatPool]);
    const threeWayShuffled = shuffle([...threeWayPool]);

    // Counters for each type
    let mcIdx = 0, gibIdx = 0, dodIdx = 0, twIdx = 0;

    const fallbackToFull = (
      pool: SeedMC[] | SeedGibberish[] | SeedDisOrDat[] | SeedThreeWay[],
      needed: number
    ) => pool.length < needed;

    // If any pool runs dry, reset seen and use full pool
    const mcNeeded = QUESTION_TYPE_SCHEDULE.filter((t) => t === 'multiple_choice').length;
    const gibNeeded = QUESTION_TYPE_SCHEDULE.filter((t) => t === 'gibberish').length;
    const dodNeeded = QUESTION_TYPE_SCHEDULE.filter((t) => t === 'dis_or_dat').length;
    const twNeeded = QUESTION_TYPE_SCHEDULE.filter((t) => t === 'three_way').length;

    if (
      fallbackToFull(mcPool, mcNeeded) ||
      fallbackToFull(gibberishPool, gibNeeded) ||
      fallbackToFull(disOrDatPool, dodNeeded) ||
      fallbackToFull(threeWayPool, twNeeded)
    ) {
      resetSeenQuestions(groupHash);
      seenIds = [];
      mcIdx = gibIdx = dodIdx = twIdx = 0;
      mcShuffled.push(...shuffle(seedMCData as SeedMC[]));
      gibberishShuffled.push(...shuffle(seedGibberishData as SeedGibberish[]));
      disOrDatShuffled.push(...shuffle(seedDisOrDatData as SeedDisOrDat[]));
      threeWayShuffled.push(...shuffle(seedThreeWayData as SeedThreeWay[]));
    }

    const round1Values = assignQuestionValues(1);
    const round2Values = assignQuestionValues(2);
    const selectedIds: string[] = [];

    this.questions = QUESTION_TYPE_SCHEDULE.map((type, i) => {
      const round = i < QUESTIONS_PER_ROUND ? 1 : 2;
      const indexInRound = i < QUESTIONS_PER_ROUND ? i : i - QUESTIONS_PER_ROUND;
      const values = round === 1 ? round1Values : round2Values;
      const value = values[indexInRound];
      const timeLimit = type === 'dis_or_dat'
        ? DURATIONS.DIS_OR_DAT_ACTIVE / 1000
        : DURATIONS.QUESTION_ACTIVE / 1000;

      if (type === 'multiple_choice') {
        const seed = mcShuffled[mcIdx++ % mcShuffled.length];
        selectedIds.push(seed.id);
        return {
          id: seed.id,
          type: 'multiple_choice' as const,
          category: seed.category,
          prompt: seed.prompt,
          choices: seed.choices,
          correctIndex: seed.correctIndex,
          value,
          timeLimit,
          hostIntro: seed.hostIntro,
          hostCorrect: seed.hostCorrect,
          hostWrong: seed.hostWrong,
          hostTimeout: seed.hostTimeout,
        } satisfies MultipleChoiceQuestion;
      }

      if (type === 'gibberish') {
        const seed = gibberishShuffled[gibIdx++ % gibberishShuffled.length];
        selectedIds.push(seed.id);
        return {
          id: seed.id,
          type: 'gibberish' as const,
          category: seed.category,
          gibberishPhrase: seed.gibberishPhrase,
          choices: seed.choices,
          correctIndex: seed.correctIndex,
          hint: seed.hint,
          value,
          timeLimit,
          hostIntro: seed.hostIntro,
          hostCorrect: seed.hostCorrect,
          hostWrong: seed.hostWrong,
          hostTimeout: seed.hostTimeout,
        } satisfies GibberishQuestion;
      }

      if (type === 'dis_or_dat') {
        const seed = disOrDatShuffled[dodIdx++ % disOrDatShuffled.length];
        selectedIds.push(seed.id);
        return {
          id: seed.id,
          type: 'dis_or_dat' as const,
          category: seed.category,
          categoryA: seed.categoryA,
          categoryB: seed.categoryB,
          items: seed.items,
          value,
          timeLimit,
          hostIntro: seed.hostIntro,
          hostCorrect: seed.hostCorrect,
          hostWrong: seed.hostWrong,
          hostTimeout: seed.hostTimeout,
        } satisfies DisOrDatQuestion;
      }

      // three_way
      const seed = threeWayShuffled[twIdx++ % threeWayShuffled.length];
      selectedIds.push(seed.id);
      return {
        id: seed.id,
        type: 'three_way' as const,
        category: seed.category,
        prompt: seed.prompt,
        choices: seed.choices,
        correctIndex: seed.correctIndex,
        value,
        timeLimit,
        hostIntro: seed.hostIntro,
        hostCorrect: seed.hostCorrect,
        hostWrong: seed.hostWrong,
        hostTimeout: seed.hostTimeout,
      } satisfies ThreeWayQuestion;
    });

    // Pick Jack Attack round
    const jaPool = seedJackAttackData as SeedJackAttack[];
    this.jackAttackData = jaPool[Math.floor(Math.random() * jaPool.length)];

    recordSeenQuestions(groupHash, selectedIds);
    this.room.questions = this.questions;
  }

  // ============================================================
  // Private — State Machine: Regular Questions
  // ============================================================

  private startQuestionIntro(): void {
    if (this.destroyed) return;

    const q = this.questions[this.room.questionIndex];
    if (!q) {
      this.startJackAttackIntro();
      return;
    }

    this.room.state = GameState.QUESTION_INTRO;
    this.currentAnswers.clear();
    this.disOrDatAnswers.clear();
    this.wimpMode = false;

    const base = {
      id: q.id,
      type: q.type,
      category: q.category,
      value: q.value,
      timeLimit: q.timeLimit,
      questionIndex: this.room.questionIndex,
      totalQuestions: TOTAL_QUESTIONS,
      round: this.room.round,
    };

    this.emit('question_intro', {
      question: base,
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
    this.questionTimeLimit = q.type === 'dis_or_dat'
      ? DURATIONS.DIS_OR_DAT_ACTIVE
      : DURATIONS.QUESTION_ACTIVE;

    const base = {
      id: q.id,
      type: q.type,
      category: q.category,
      value: q.value,
      timeLimit: q.timeLimit,
      questionIndex: this.room.questionIndex,
      totalQuestions: TOTAL_QUESTIONS,
      round: this.room.round,
    };

    let fullQuestion: Record<string, unknown>;

    if (q.type === 'multiple_choice') {
      const mc = q as MultipleChoiceQuestion;
      fullQuestion = { ...base, prompt: mc.prompt, choices: mc.choices };
    } else if (q.type === 'gibberish') {
      const g = q as GibberishQuestion;
      fullQuestion = {
        ...base,
        gibberishPhrase: g.gibberishPhrase,
        choices: g.choices,
        hint: g.hint,
      };
    } else if (q.type === 'dis_or_dat') {
      const d = q as DisOrDatQuestion;
      fullQuestion = {
        ...base,
        categoryA: d.categoryA,
        categoryB: d.categoryB,
        items: d.items.map((item) => ({ text: item.text })), // strip correct answer
      };
    } else {
      // three_way
      const tw = q as ThreeWayQuestion;
      fullQuestion = { ...base, prompt: tw.prompt, choices: tw.choices };
    }

    this.emit('question_active', {
      question: fullQuestion,
      timeLimit: this.questionTimeLimit / 1000,
    });

    this.scheduleNext(this.questionTimeLimit, () => this.onQuestionTimeout());
  }

  private onQuestionTimeout(): void {
    if (this.destroyed) return;

    const q = this.questions[this.room.questionIndex];
    if (!q) return;

    // Wimp Mode only applies to non-DisOrDat types
    if (
      q.type !== 'dis_or_dat' &&
      this.currentAnswers.size === 0 &&
      !this.wimpMode
    ) {
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

    const base = {
      id: q.id,
      type: q.type,
      category: q.category,
      value: q.value,
      timeLimit: DURATIONS.WIMP_TIMER / 1000,
      questionIndex: this.room.questionIndex,
      totalQuestions: TOTAL_QUESTIONS,
      round: this.room.round,
    };

    let fullQuestion: Record<string, unknown> = { ...base };
    if (q.type === 'multiple_choice') {
      const mc = q as MultipleChoiceQuestion;
      fullQuestion = { ...fullQuestion, prompt: mc.prompt, choices: mc.choices };
    } else if (q.type === 'gibberish') {
      const g = q as GibberishQuestion;
      fullQuestion = { ...fullQuestion, gibberishPhrase: g.gibberishPhrase, choices: g.choices };
    } else if (q.type === 'three_way') {
      const tw = q as ThreeWayQuestion;
      fullQuestion = { ...fullQuestion, prompt: tw.prompt, choices: tw.choices };
    }

    this.emit('question_active', {
      question: { ...fullQuestion, hostScript: wimpScript },
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

    if (q.type === 'dis_or_dat') {
      this.revealDisOrDat(q as DisOrDatQuestion);
    } else {
      this.revealSingleAnswer(q as MultipleChoiceQuestion | GibberishQuestion | ThreeWayQuestion);
    }
  }

  private revealSingleAnswer(
    q: MultipleChoiceQuestion | GibberishQuestion | ThreeWayQuestion
  ): void {
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
        const timeRemaining = Math.max(
          0,
          this.questionTimeLimit - (answer!.timestamp - this.questionStartTime)
        );
        const result = calculateScore(q.value, isCorrect, timeRemaining, this.questionTimeLimit);
        moneyEarned = result.total;
        speedBonus = result.speedBonus;
      }

      player.money += moneyEarned;
      player.streak = updateStreak(player.streak, isCorrect);

      const correctCount =
        player.answers.filter((a) => a.isCorrect).length + (isCorrect ? 1 : 0);
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

    const correctPlayers = playerResults.filter((r) => r.isCorrect);
    const wrongPlayers = playerResults.filter(
      (r) => !r.isCorrect && r.selectedIndex !== undefined
    );
    let hostScript: string;
    if (correctPlayers.length === 0) hostScript = q.hostTimeout;
    else if (wrongPlayers.length === 0) hostScript = q.hostCorrect + ' Everyone got it!';
    else hostScript = correctPlayers.length > wrongPlayers.length ? q.hostCorrect : q.hostWrong;

    this.emit('question_reveal', {
      correctAnswer: q.correctIndex,
      playerResults,
      hostScript,
    });

    this.scheduleNext(DURATIONS.QUESTION_REVEAL, () => this.showScores());
  }

  private revealDisOrDat(q: DisOrDatQuestion): void {
    const correctAnswers = q.items.map((item) => item.correct);

    const playerResults: {
      playerId: string;
      name: string;
      isCorrect: boolean;
      moneyEarned: number;
      speedBonus: number;
      correctItems: number;
      totalItems: number;
    }[] = [];

    const pointsPerItem = Math.round(q.value / q.items.length);

    for (const player of this.room.players) {
      const answers = this.disOrDatAnswers.get(player.id) || [];
      let correctItems = 0;

      for (let i = 0; i < q.items.length; i++) {
        if (answers[i] === correctAnswers[i]) correctItems++;
      }

      const moneyEarned = correctItems * pointsPerItem;
      const isCorrect = correctItems === q.items.length; // "fully correct" for streak

      player.money += moneyEarned;
      player.streak = updateStreak(player.streak, isCorrect);

      player.answers.push({
        questionId: q.id,
        questionType: q.type,
        answeredAt: Date.now(),
        timeToAnswer: 0,
        isCorrect,
        moneyEarned,
        speedBonus: 0,
      });

      playerResults.push({
        playerId: player.id,
        name: player.name,
        isCorrect: correctItems >= Math.ceil(q.items.length / 2), // show ✓ if majority correct
        moneyEarned,
        speedBonus: 0,
        correctItems,
        totalItems: q.items.length,
      });
    }

    const avgCorrect =
      playerResults.reduce((s, r) => s + r.correctItems, 0) / Math.max(playerResults.length, 1);

    const hostScript =
      avgCorrect >= q.items.length * 0.7
        ? q.hostCorrect
        : avgCorrect >= q.items.length * 0.4
          ? q.hostWrong
          : q.hostTimeout;

    this.emit('question_reveal', {
      correctAnswer: null,
      disOrDatCorrect: correctAnswers,
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

    if (this.room.questionIndex === QUESTIONS_PER_ROUND && this.room.round === 1) {
      this.room.round = 2;
      this.room.state = GameState.ROUND_TRANSITION;

      this.emit('round_transition', {
        round: 2,
        hostScript: 'Round 2! All values are DOUBLED! Things are about to get serious.',
      });

      this.scheduleNext(DURATIONS.ROUND_TRANSITION, () => this.startQuestionIntro());
      return;
    }

    if (this.room.questionIndex >= TOTAL_QUESTIONS) {
      this.startJackAttackIntro();
      return;
    }

    this.startQuestionIntro();
  }

  // ============================================================
  // Private — Jack Attack
  // ============================================================

  private startJackAttackIntro(): void {
    if (this.destroyed) return;
    if (!this.jackAttackData) {
      this.endGame();
      return;
    }

    this.room.state = GameState.JACK_ATTACK_INTRO;
    this.jackAttackWordIndex = 0;
    this.jackAttackWordActive = false;
    this.buzzedOnCurrentWord.clear();

    this.emit('jack_attack_intro', {
      theme: this.jackAttackData.theme,
      clue: this.jackAttackData.clue,
      hostScript: this.jackAttackData.hostIntro,
    });

    this.scheduleNext(DURATIONS.JACK_ATTACK_INTRO, () => {
      this.room.state = GameState.JACK_ATTACK_ACTIVE;
      this.sendNextJackAttackWord();
    });
  }

  private sendNextJackAttackWord(): void {
    if (this.destroyed) return;

    const data = this.jackAttackData!;

    if (this.jackAttackWordIndex >= data.pairs.length) {
      this.endJackAttack();
      return;
    }

    const pair = data.pairs[this.jackAttackWordIndex];
    const wordId = `jk_${this.jackAttackWordIndex}`;
    const expiresAt = Date.now() + DURATIONS.JACK_ATTACK_WORD_INTERVAL;

    this.jackAttackCurrentWordId = wordId;
    this.jackAttackCurrentIsCorrect = pair.isCorrect;
    this.jackAttackWordActive = true;
    this.buzzedOnCurrentWord.clear();
    this.jackAttackWordIndex++;

    this.emit('jack_attack_word', { wordId, word: pair.answer, expiresAt });

    this.scheduleNext(DURATIONS.JACK_ATTACK_WORD_INTERVAL, () => {
      this.jackAttackWordActive = false;
      this.sendNextJackAttackWord();
    });
  }

  private endJackAttack(): void {
    if (this.destroyed) return;

    this.room.state = GameState.JACK_ATTACK_RESULTS;
    this.jackAttackWordActive = false;

    const scores = this.room.players
      .map((p) => ({ playerId: p.id, name: p.name, money: p.money }))
      .sort((a, b) => b.money - a.money);

    const winner = scores[0];
    const hostScript = winner
      ? `Jack Attack is over! After all that mayhem, ${winner.name} is in the lead with $${winner.money.toLocaleString()}. Let's see the final numbers!`
      : 'Jack Attack is over! Let\'s see who survived!';

    this.emit('jack_attack_end', { scores, hostScript });

    this.scheduleNext(DURATIONS.JACK_ATTACK_RESULTS, () => this.endGame());
  }

  // ============================================================
  // Private — Game Over
  // ============================================================

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

    this.emit('game_over', { finalScores, hostScript });
    this.saveResults(finalScores);
  }

  private async saveResults(
    finalScores: { playerId: string; name: string; money: number }[]
  ): Promise<void> {
    try {
      const playerNames = this.room.players.map((p) => p.name);
      const scoresObj: Record<string, number> = {};
      for (const s of finalScores) scoresObj[s.name] = s.money;

      saveGameResult({
        room_code: this.roomCode,
        player_names: JSON.stringify(playerNames),
        final_scores: JSON.stringify(scoresObj),
        winner_name: finalScores[0]?.name || 'Unknown',
        question_count: TOTAL_QUESTIONS,
        duration_seconds: Math.round(
          (Date.now() - (this.room.startedAt || Date.now())) / 1000
        ),
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
    const last = names[names.length - 1];
    const rest = names.slice(0, -1);
    return `Welcome to You Don't Know Jack! We've got ${rest.join(', ')}, and ${last}. ${this.room.players.length} players, zero excuses. Let's go!`;
  }
}
