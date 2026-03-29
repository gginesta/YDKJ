/**
 * Question Pipeline Orchestrator
 *
 * This is the main entry point for generating game questions.
 * It orchestrates the full flow:
 *   1. Check cache for existing questions
 *   2. Fetch seed facts from Open Trivia DB
 *   3. Send seeds to Claude with YDKJ prompt
 *   4. Validate the output
 *   5. Cache results and track seen questions
 *   6. Fall back to seed bank if anything fails
 */

import { generateWithTool } from './claude-client';
import { fetchSeedFacts } from './trivia-api';
import {
  buildSystemPrompt,
  buildSeedFactsMessage,
  questionGenerationTool,
  type QuestionGenerationContext,
  type SeedFact,
} from './prompts/question-generation';
import {
  hashPlayerGroup,
  getSeenQuestionIds,
  recordSeenQuestions,
  resetSeenQuestions,
  cacheQuestion,
  getCachedQuestion,
} from '../db';
import seedQuestionsData from './seed-questions.json';

interface GeneratedQuestion {
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

interface PipelineResult {
  questions: GeneratedQuestion[];
  source: 'ai' | 'cache' | 'seed';
}

/**
 * Validate a single AI-generated question.
 * Returns an array of issues (empty = valid).
 */
function validateQuestion(q: GeneratedQuestion): string[] {
  const issues: string[] = [];

  if (!q.prompt || q.prompt.length < 15) issues.push('Prompt too short');
  if (q.prompt && q.prompt.length > 500) issues.push('Prompt too long for voice');
  if (!Array.isArray(q.choices) || q.choices.length !== 4) issues.push('Must have exactly 4 choices');
  if (q.correctIndex < 0 || q.correctIndex > 3) issues.push('Invalid correctIndex');
  if (q.choices && new Set(q.choices).size !== q.choices.length) issues.push('Duplicate choices');
  if (!q.hostIntro || q.hostIntro.length < 10) issues.push('Host intro too short');
  if (!q.hostCorrect) issues.push('Missing hostCorrect');
  if (!q.hostWrong) issues.push('Missing hostWrong');
  if (!q.hostTimeout) issues.push('Missing hostTimeout');

  return issues;
}

/**
 * Generate questions using Claude AI.
 * Returns null if AI generation fails entirely.
 */
async function generateAIQuestions(
  context: QuestionGenerationContext,
  seeds: SeedFact[]
): Promise<GeneratedQuestion[] | null> {
  const systemPrompt = buildSystemPrompt(context);
  const userMessage = buildSeedFactsMessage(seeds, context);

  const result = await generateWithTool<{ questions: GeneratedQuestion[] }>(
    systemPrompt,
    userMessage,
    questionGenerationTool as Parameters<typeof generateWithTool>[2]
  );

  if (!result.success || !result.data?.questions) {
    console.error('[Pipeline] AI generation failed:', result.error);
    return null;
  }

  // Validate each question, keep only valid ones
  const valid: GeneratedQuestion[] = [];
  for (const q of result.data.questions) {
    const issues = validateQuestion(q);
    if (issues.length === 0) {
      valid.push(q);
    } else {
      console.warn(`[Pipeline] Dropping invalid AI question: ${issues.join(', ')}`);
    }
  }

  return valid.length > 0 ? valid : null;
}

/**
 * Get questions from the seed bank (fallback).
 * Respects dedup tracking per player group.
 */
function getSeedQuestions(
  count: number,
  playerNames: string[]
): GeneratedQuestion[] {
  const seed = seedQuestionsData as GeneratedQuestion[];
  const groupHash = hashPlayerGroup(playerNames);
  let seenIds = getSeenQuestionIds(groupHash);

  const seedWithIds = seed as (GeneratedQuestion & { id?: string })[];
  let pool = seedWithIds.filter((q) => !q.id || !seenIds.includes(q.id));

  if (pool.length < count) {
    resetSeenQuestions(groupHash);
    seenIds = [];
    pool = [...seedWithIds];
  }

  // Shuffle and pick
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  // Record as seen
  const selectedIds = selected.map((q) => q.id).filter((id): id is string => !!id);
  if (selectedIds.length > 0) {
    recordSeenQuestions(groupHash, selectedIds);
  }

  return selected;
}

/**
 * Main pipeline: generate or fetch questions for a game.
 *
 * @param playerNames Names of players in this game
 * @param questionsNeeded Number of questions to generate (default 12: 10 + 2 backup)
 * @param round Current round (1 or 2)
 * @param theme Optional theme for the game
 */
export async function generateGameQuestions(
  playerNames: string[],
  questionsNeeded: number = 12,
  round: number = 1,
  theme?: string
): Promise<PipelineResult> {
  const context: QuestionGenerationContext = {
    playerNames,
    theme,
    round,
    questionsNeeded,
  };

  // Step 1: Try AI generation
  try {
    // Fetch seed facts from Open Trivia DB
    const seeds = await fetchSeedFacts(questionsNeeded + 5);
    console.log(`[Pipeline] Fetched ${seeds.length} seed facts from Open Trivia DB`);

    if (seeds.length >= 5) {
      // We have enough seeds — send to Claude
      const aiQuestions = await generateAIQuestions(context, seeds);

      if (aiQuestions && aiQuestions.length >= questionsNeeded) {
        console.log(`[Pipeline] AI generated ${aiQuestions.length} valid questions`);

        // Cache the AI questions
        const groupHash = hashPlayerGroup(playerNames);
        const questionIds: string[] = [];
        for (let i = 0; i < aiQuestions.length; i++) {
          const qId = `ai_${Date.now()}_${i}`;
          questionIds.push(qId);
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          cacheQuestion(qId, 'multiple_choice', aiQuestions[i].category, JSON.stringify(aiQuestions[i]), expiresAt);
        }
        recordSeenQuestions(groupHash, questionIds);

        return { questions: aiQuestions.slice(0, questionsNeeded), source: 'ai' };
      }

      // AI returned fewer than needed — supplement with seeds
      if (aiQuestions && aiQuestions.length > 0) {
        console.log(`[Pipeline] AI returned ${aiQuestions.length}/${questionsNeeded}, supplementing with seed bank`);
        const remaining = questionsNeeded - aiQuestions.length;
        const seedSupplements = getSeedQuestions(remaining, playerNames);
        return { questions: [...aiQuestions, ...seedSupplements], source: 'ai' };
      }
    }
  } catch (err) {
    console.error('[Pipeline] AI pipeline error:', err);
  }

  // Step 2: Fallback to seed bank
  console.log('[Pipeline] Falling back to seed question bank');
  const seedQuestions = getSeedQuestions(questionsNeeded, playerNames);
  return { questions: seedQuestions, source: 'seed' };
}
