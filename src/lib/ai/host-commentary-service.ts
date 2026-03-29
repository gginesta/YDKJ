/**
 * Host Commentary Service
 *
 * Sits between the game engine and Claude API.
 * Every method races an AI call against a timeout and
 * always returns a string (AI-generated or static fallback).
 * The game never stalls waiting for AI.
 */

import { generateText } from './claude-client';
import { generateSpeechDataUrl, isVoiceEnabled } from '../voice/elevenlabs-client';
import {
  HOST_PERSONALITY,
  buildGameIntroPrompt,
  buildTransitionPrompt,
  buildRoundTransitionPrompt,
  buildGameOutroPrompt,
  type GameContext,
} from './prompts/host-commentary';
import type { GameRoom, MultipleChoiceQuestion } from '../../types/game';

interface PlayerResult {
  playerId: string;
  name: string;
  isCorrect: boolean;
  moneyEarned: number;
  speedBonus: number;
  selectedIndex?: number;
}

const AI_TIMEOUT_MS = 3500;

export interface CommentaryResult {
  text: string;
  audioUrl: string | null;
}

export class HostCommentaryService {
  private previousLines: string[] = [];

  /**
   * Race an AI call against a timeout. Always returns a string.
   */
  private async raceWithFallback(
    aiPromise: Promise<string | null>,
    fallback: string
  ): Promise<string> {
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), AI_TIMEOUT_MS)
    );
    const result = await Promise.race([aiPromise, timeout]);
    const line = result || fallback;
    this.trackLine(line);
    return line;
  }

  private trackLine(line: string): void {
    this.previousLines.push(line);
    if (this.previousLines.length > 5) {
      this.previousLines.shift();
    }
  }

  /**
   * Generate TTS audio for a text line. Returns null if voice is disabled or fails.
   */
  private async generateAudio(text: string): Promise<string | null> {
    if (!isVoiceEnabled()) return null;
    try {
      return await generateSpeechDataUrl(text);
    } catch {
      return null;
    }
  }

  /**
   * Get commentary with optional voice audio.
   * Text resolves first (fast), audio generates in parallel.
   */
  async getCommentaryWithAudio(
    textPromise: Promise<string>,
  ): Promise<CommentaryResult> {
    const text = await textPromise;
    // Fire TTS in parallel — don't block on it
    const audioUrl = await this.generateAudio(text);
    return { text, audioUrl };
  }

  private buildContext(room: GameRoom, lastResults?: PlayerResult[]): GameContext {
    const scores: Record<string, number> = {};
    const streaks: Record<string, number> = {};
    for (const p of room.players) {
      scores[p.name] = p.money;
      streaks[p.name] = p.streak;
    }

    return {
      playerNames: room.players.map((p) => p.name),
      scores,
      streaks,
      questionNumber: room.questionIndex + 1,
      round: room.round,
      totalQuestions: 10,
      lastQuestionResults: (lastResults || []).map((r) => ({
        playerName: r.name,
        wasCorrect: r.isCorrect,
        timeToAnswer: 0,
      })),
      previousHostLines: [...this.previousLines],
    };
  }

  /**
   * Game intro — welcome players by name.
   */
  async getGameIntro(room: GameRoom, staticFallback: string): Promise<string> {
    const playerNames = room.players.map((p) => p.name);
    const prompt = buildGameIntroPrompt(playerNames);

    return this.raceWithFallback(
      generateText(prompt, 'Generate the game intro now. Write ONLY the intro text.'),
      staticFallback
    );
  }

  /**
   * Question intro — set the mood before showing the question.
   */
  async getQuestionIntro(
    room: GameRoom,
    question: MultipleChoiceQuestion,
    staticFallback: string
  ): Promise<string> {
    const context = this.buildContext(room);

    const prompt = `${HOST_PERSONALITY}

GAME STATE:
- About to show Question ${context.questionNumber} of ${context.totalQuestions}. ${room.round === 2 ? 'Round 2 — values doubled.' : 'Round 1.'}
- Category: ${question.category}
- Value: $${question.value.toLocaleString()}
- Scores: ${Object.entries(context.scores).map(([n, s]) => `${n}: $${s.toLocaleString()}`).join(', ')}
- Previous host lines (DON'T repeat): ${this.previousLines.slice(-3).join(' | ')}

Generate a SHORT intro line (1-2 sentences) to lead into this question. Set the mood for the "${question.category}" category. Don't reveal the answer or make it obvious. Be conversational.`;

    return this.raceWithFallback(
      generateText(prompt, 'Write the question intro now. ONLY the intro text, nothing else.'),
      staticFallback
    );
  }

  /**
   * Question reveal — react to who got it right/wrong.
   */
  async getQuestionReveal(
    room: GameRoom,
    question: MultipleChoiceQuestion,
    playerResults: PlayerResult[],
    staticFallback: string
  ): Promise<string> {
    const correctPlayers = playerResults.filter((r) => r.isCorrect);
    const wrongPlayers = playerResults.filter((r) => !r.isCorrect && r.selectedIndex !== undefined);
    const timeoutPlayers = playerResults.filter((r) => r.selectedIndex === undefined);

    const context = this.buildContext(room, playerResults);

    const prompt = `${HOST_PERSONALITY}

GAME STATE:
- Question ${context.questionNumber}: "${question.prompt}"
- Correct answer: "${question.choices[question.correctIndex]}"
- Got it RIGHT: ${correctPlayers.length > 0 ? correctPlayers.map((r) => r.name).join(', ') : 'Nobody'}
- Got it WRONG: ${wrongPlayers.length > 0 ? wrongPlayers.map((r) => r.name).join(', ') : 'Nobody'}
- Didn't answer: ${timeoutPlayers.length > 0 ? timeoutPlayers.map((r) => r.name).join(', ') : 'Nobody'}
- Scores after: ${Object.entries(context.scores).map(([n, s]) => `${n}: $${s.toLocaleString()}`).join(', ')}
- Previous host lines (DON'T repeat): ${this.previousLines.slice(-3).join(' | ')}

Generate a SHORT reaction (1-2 sentences). React specifically to who got it right or wrong. Use names. If everyone got it right, be impressed. If everyone got it wrong, be theatrical about it. Add a fun fact about the correct answer if you can.`;

    return this.raceWithFallback(
      generateText(prompt, 'Write the reveal reaction now. ONLY the reaction text.'),
      staticFallback
    );
  }

  /**
   * Scores transition — between questions.
   */
  async getScoresTransition(
    room: GameRoom,
    playerResults: PlayerResult[]
  ): Promise<string | null> {
    const context = this.buildContext(room, playerResults);
    const prompt = buildTransitionPrompt(context);

    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), AI_TIMEOUT_MS)
    );
    const result = await Promise.race([
      generateText(prompt, 'Write the transition line now. ONLY the text.'),
      timeout,
    ]);

    if (result) this.trackLine(result);
    return result;
  }

  /**
   * Round 2 transition — hype the doubled values.
   */
  async getRoundTransition(room: GameRoom, staticFallback: string): Promise<string> {
    const context = this.buildContext(room);
    const prompt = buildRoundTransitionPrompt(context);

    return this.raceWithFallback(
      generateText(prompt, 'Write the round 2 announcement now. ONLY the text.'),
      staticFallback
    );
  }

  /**
   * Game over — crown winner, roast loser.
   */
  async getGameOutro(room: GameRoom, staticFallback: string): Promise<string> {
    const context = this.buildContext(room);
    const prompt = buildGameOutroPrompt(context);

    return this.raceWithFallback(
      generateText(prompt, 'Write the game outro now. ONLY the text.'),
      staticFallback
    );
  }

  // ============================================================
  // WithAudio variants — return text + audio together
  // ============================================================

  async getGameIntroWithAudio(room: GameRoom, staticFallback: string): Promise<CommentaryResult> {
    const text = await this.getGameIntro(room, staticFallback);
    const audioUrl = await this.generateAudio(text);
    return { text, audioUrl };
  }

  async getQuestionIntroWithAudio(
    room: GameRoom,
    question: MultipleChoiceQuestion,
    staticFallback: string
  ): Promise<CommentaryResult> {
    const text = await this.getQuestionIntro(room, question, staticFallback);
    const audioUrl = await this.generateAudio(text);
    return { text, audioUrl };
  }

  async getQuestionRevealWithAudio(
    room: GameRoom,
    question: MultipleChoiceQuestion,
    playerResults: PlayerResult[],
    staticFallback: string
  ): Promise<CommentaryResult> {
    const text = await this.getQuestionReveal(room, question, playerResults, staticFallback);
    const audioUrl = await this.generateAudio(text);
    return { text, audioUrl };
  }

  async getRoundTransitionWithAudio(room: GameRoom, staticFallback: string): Promise<CommentaryResult> {
    const text = await this.getRoundTransition(room, staticFallback);
    const audioUrl = await this.generateAudio(text);
    return { text, audioUrl };
  }

  async getGameOutroWithAudio(room: GameRoom, staticFallback: string): Promise<CommentaryResult> {
    const text = await this.getGameOutro(room, staticFallback);
    const audioUrl = await this.generateAudio(text);
    return { text, audioUrl };
  }

  /**
   * Reset for a new game.
   */
  reset(): void {
    this.previousLines = [];
  }
}
