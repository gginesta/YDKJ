import { getClaudeClient, isClaudeAvailable } from './claude-client';
import {
  QUESTION_GENERATION_SYSTEM,
  QUESTION_GENERATION_TOOL,
  buildQuestionGenerationMessage,
} from './prompts/question-generation';
import {
  HOST_PERSONALITY_SYSTEM,
  buildTransitionCommentary,
  buildRoundTransitionCommentary,
  buildGameOutroCommentary,
  type CommentaryContext,
} from './prompts/host-commentary';
import { hashPlayerGroup, getSeenQuestionIds, recordSeenQuestions, resetSeenQuestions } from '../db';
import seedQuestionsData from './seed-questions.json';
import type { MultipleChoiceQuestion } from '../../types/game';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Types
// ============================================================

interface GeneratedQuestion {
  category: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  hostIntro: string;
  hostCorrect: string;
  hostWrong: string;
  hostTimeout: string;
}

interface GenerationResult {
  questions: GeneratedQuestion[];
  gameIntro: string;
  gameOutro: string;
}

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

// ============================================================
// Question Validation
// ============================================================

interface ValidationResult {
  valid: boolean;
  issues: string[];
}

function validateQuestion(q: GeneratedQuestion): ValidationResult {
  const issues: string[] = [];

  if (!q.category || q.category.length < 2) issues.push('Missing or too short category');
  if (!q.prompt || q.prompt.length < 20) issues.push('Question prompt too short');
  if (q.prompt && q.prompt.length > 500) issues.push('Question prompt too long for voice');
  if (!Array.isArray(q.choices) || q.choices.length !== 4) issues.push('Must have exactly 4 choices');
  if (q.choices && new Set(q.choices).size !== q.choices.length) issues.push('Duplicate answer choices');
  if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
    issues.push('Invalid correctIndex (must be 0-3)');
  }
  if (!q.hostIntro || q.hostIntro.length < 20) issues.push('Host intro too short');
  if (q.hostIntro && q.hostIntro.length > 600) issues.push('Host intro too long (>30s of speech)');
  if (!q.hostCorrect) issues.push('Missing host correct reaction');
  if (!q.hostWrong) issues.push('Missing host wrong reaction');
  if (!q.hostTimeout) issues.push('Missing host timeout reaction');

  return { valid: issues.length === 0, issues };
}

// ============================================================
// AI Question Generation
// ============================================================

/**
 * Generate questions using Claude API.
 * Returns null if generation fails.
 */
async function generateQuestionsFromClaude(
  playerNames: string[],
  theme?: string
): Promise<GenerationResult | null> {
  const client = getClaudeClient();
  if (!client) return null;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: QUESTION_GENERATION_SYSTEM,
      tools: [QUESTION_GENERATION_TOOL],
      tool_choice: { type: 'tool', name: 'generate_game_questions' },
      messages: [
        {
          role: 'user',
          content: buildQuestionGenerationMessage(playerNames, theme),
        },
      ],
    });

    // Extract tool use result
    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      console.error('[QuestionPipeline] No tool_use block in Claude response');
      return null;
    }

    const input = toolUse.input as {
      questions: GeneratedQuestion[];
      gameIntro: string;
      gameOutro: string;
    };

    if (!input.questions || !Array.isArray(input.questions)) {
      console.error('[QuestionPipeline] Invalid questions array in response');
      return null;
    }

    return {
      questions: input.questions,
      gameIntro: input.gameIntro || '',
      gameOutro: input.gameOutro || '',
    };
  } catch (err) {
    console.error('[QuestionPipeline] Claude API error:', err);
    return null;
  }
}

// ============================================================
// Seed Question Fallback
// ============================================================

function loadSeedQuestions(
  playerNames: string[],
  count: number
): { questions: SeedQuestion[]; fromSeed: boolean } {
  const seed = seedQuestionsData as SeedQuestion[];
  const groupHash = hashPlayerGroup(playerNames);
  let seenIds = getSeenQuestionIds(groupHash);

  let pool = seed.filter((q) => !seenIds.includes(q.id));

  if (pool.length < count) {
    resetSeenQuestions(groupHash);
    seenIds = [];
    pool = [...seed];
  }

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selected = pool.slice(0, count);
  recordSeenQuestions(groupHash, selected.map((q) => q.id));

  return { questions: selected, fromSeed: true };
}

// ============================================================
// Pipeline Orchestration
// ============================================================

const TOTAL_QUESTIONS = 10;
const QUESTIONS_PER_ROUND = 5;

/**
 * Assign dollar values for questions.
 */
function assignQuestionValues(round: number): number[] {
  const base = [1000, 1000, 2000, 2000, 3000];
  const multiplier = round >= 2 ? 2 : 1;
  return base.map((v) => v * multiplier);
}

/**
 * Convert generated or seed questions to MultipleChoiceQuestion format with values.
 */
function toGameQuestions(
  questions: (GeneratedQuestion | SeedQuestion)[]
): MultipleChoiceQuestion[] {
  const round1Values = assignQuestionValues(1);
  const round2Values = assignQuestionValues(2);

  return questions.slice(0, TOTAL_QUESTIONS).map((q, i): MultipleChoiceQuestion => {
    const round = i < QUESTIONS_PER_ROUND ? 1 : 2;
    const indexInRound = i < QUESTIONS_PER_ROUND ? i : i - QUESTIONS_PER_ROUND;
    const values = round === 1 ? round1Values : round2Values;

    return {
      id: 'id' in q ? (q as SeedQuestion).id : `ai-${uuidv4().slice(0, 8)}`,
      type: 'multiple_choice',
      category: q.category,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: q.correctIndex,
      value: values[indexInRound],
      timeLimit: 20,
      hostIntro: q.hostIntro,
      hostCorrect: q.hostCorrect,
      hostWrong: q.hostWrong,
      hostTimeout: q.hostTimeout,
    };
  });
}

/**
 * Main pipeline: generate questions for a game.
 * Tries Claude API first, falls back to seed questions.
 *
 * Returns: { questions, gameIntro, gameOutro, source }
 */
export async function generateGameQuestions(
  playerNames: string[],
  theme?: string
): Promise<{
  questions: MultipleChoiceQuestion[];
  gameIntro: string;
  gameOutro: string;
  source: 'ai' | 'seed';
}> {
  // Try AI generation first
  if (isClaudeAvailable()) {
    console.log('[QuestionPipeline] Generating questions via Claude API...');

    const result = await generateQuestionsFromClaude(playerNames, theme);

    if (result && result.questions.length >= TOTAL_QUESTIONS) {
      // Validate each question
      const validQuestions: GeneratedQuestion[] = [];
      const invalidCount: number[] = [];

      for (let i = 0; i < result.questions.length; i++) {
        const validation = validateQuestion(result.questions[i]);
        if (validation.valid) {
          validQuestions.push(result.questions[i]);
        } else {
          invalidCount.push(i);
          console.warn(`[QuestionPipeline] Question ${i} failed validation:`, validation.issues);
        }
      }

      if (validQuestions.length >= TOTAL_QUESTIONS) {
        console.log(`[QuestionPipeline] AI generated ${validQuestions.length} valid questions`);

        // Record AI questions as seen (using generated IDs)
        const gameQuestions = toGameQuestions(validQuestions);
        const groupHash = hashPlayerGroup(playerNames);
        recordSeenQuestions(groupHash, gameQuestions.map((q) => q.id));

        return {
          questions: gameQuestions,
          gameIntro: result.gameIntro,
          gameOutro: result.gameOutro,
          source: 'ai',
        };
      }

      console.warn(
        `[QuestionPipeline] Only ${validQuestions.length} valid AI questions (need ${TOTAL_QUESTIONS}), falling back to seed`
      );
    } else {
      console.warn('[QuestionPipeline] AI generation failed or returned too few questions, falling back to seed');
    }
  }

  // Fallback to seed questions
  console.log('[QuestionPipeline] Using seed questions');
  const { questions: seedQs } = loadSeedQuestions(playerNames, TOTAL_QUESTIONS);
  const gameQuestions = toGameQuestions(seedQs);

  // Generate a basic intro from player names
  const names = [...playerNames];
  const last = names.pop();
  const introNames = names.length > 0 ? `${names.join(', ')}, and ${last}` : last;
  const gameIntro = `Welcome to You Don't Know Jack! Tonight we've got ${introNames}. ${playerNames.length} players, zero excuses. Let's go!`;

  return {
    questions: gameQuestions,
    gameIntro,
    gameOutro: `And that's the game! {winner} takes it home! Better luck next time, {loser}.`,
    source: 'seed',
  };
}

// ============================================================
// Host Commentary Generation
// ============================================================

/**
 * Generate personalized transition commentary between questions.
 * Falls back to a generic line if Claude is unavailable.
 */
export async function generateTransitionCommentary(ctx: CommentaryContext): Promise<string> {
  const client = getClaudeClient();
  if (!client) return getGenericTransitionLine(ctx);

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: HOST_PERSONALITY_SYSTEM,
      messages: [{ role: 'user', content: buildTransitionCommentary(ctx) }],
    });

    const text = response.content.find((b) => b.type === 'text');
    return text ? text.text.trim() : getGenericTransitionLine(ctx);
  } catch (err) {
    console.error('[Commentary] Transition generation failed:', err);
    return getGenericTransitionLine(ctx);
  }
}

/**
 * Generate round transition commentary.
 */
export async function generateRoundTransitionCommentary(ctx: CommentaryContext): Promise<string> {
  const client = getClaudeClient();
  if (!client) {
    return "Round 2! All values are DOUBLED! Things are about to get serious.";
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: HOST_PERSONALITY_SYSTEM,
      messages: [{ role: 'user', content: buildRoundTransitionCommentary(ctx) }],
    });

    const text = response.content.find((b) => b.type === 'text');
    return text ? text.text.trim() : "Round 2! All values are DOUBLED! Things are about to get serious.";
  } catch (err) {
    console.error('[Commentary] Round transition generation failed:', err);
    return "Round 2! All values are DOUBLED! Things are about to get serious.";
  }
}

/**
 * Generate game outro commentary.
 */
export async function generateGameOutro(
  winner: { name: string; money: number },
  loser: { name: string; money: number },
  allPlayers: { name: string; money: number }[],
  outroTemplate?: string
): Promise<string> {
  const client = getClaudeClient();
  if (!client) {
    // Use template if available
    if (outroTemplate) {
      return outroTemplate
        .replace('{winner}', winner.name)
        .replace('{loser}', loser.name);
    }
    return `And that's the game! ${winner.name} takes it home with $${winner.money.toLocaleString()}! Better luck next time, ${loser.name}.`;
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: HOST_PERSONALITY_SYSTEM,
      messages: [{ role: 'user', content: buildGameOutroCommentary(winner, loser, allPlayers) }],
    });

    const text = response.content.find((b) => b.type === 'text');
    return text ? text.text.trim() : `${winner.name} wins with $${winner.money.toLocaleString()}!`;
  } catch (err) {
    console.error('[Commentary] Outro generation failed:', err);
    return `And that's the game! ${winner.name} takes it home with $${winner.money.toLocaleString()}! Better luck next time, ${loser.name}.`;
  }
}

// ============================================================
// Generic Fallback Lines
// ============================================================

function getGenericTransitionLine(ctx: CommentaryContext): string {
  const leader = ctx.players.reduce((best, p) => (p.money > best.money ? p : best), ctx.players[0]);
  const lines = [
    `${leader.name} is in the lead with $${leader.money.toLocaleString()}. Let's see if anyone can catch up.`,
    `Moving right along! ${leader.name} is feeling confident at $${leader.money.toLocaleString()}.`,
    `Next question coming up. ${ctx.round === 2 ? "Remember, values are doubled!" : "Let's keep it moving."}`,
    `Question ${ctx.questionNumber} of ${ctx.totalQuestions}. The pressure is on.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}
