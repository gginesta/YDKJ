/**
 * Open Trivia DB Integration
 *
 * Fetches verified trivia facts to use as seeds for Claude.
 * These facts are accurate — Claude rewrites the framing/humor,
 * not the facts themselves. This prevents hallucination.
 *
 * Uses the session token system to avoid repeat questions:
 * - Request a token once, reuse across games
 * - Token tracks which questions have been served
 * - Reset token when exhausted (response code 4)
 * - Tokens expire after 6 hours of inactivity
 *
 * API docs: https://opentdb.com/api_config.php
 */

import type { SeedFact } from './prompts/question-generation';

const OPENTDB_API = 'https://opentdb.com/api.php';
const OPENTDB_TOKEN = 'https://opentdb.com/api_token.php';
const API_TIMEOUT_MS = 5000;

interface OpenTDBResponse {
  response_code: number;
  results: {
    category: string;
    type: string;
    difficulty: string;
    question: string;
    correct_answer: string;
    incorrect_answers: string[];
  }[];
}

interface TokenResponse {
  response_code: number;
  token?: string;
}

// Response codes from the API
const RESPONSE = {
  SUCCESS: 0,
  NO_RESULTS: 1,
  INVALID_PARAM: 2,
  TOKEN_NOT_FOUND: 3,
  TOKEN_EMPTY: 4,
  RATE_LIMIT: 5,
} as const;

// Module-level session token (persists across games, expires after 6h idle)
let sessionToken: string | null = null;

/**
 * Decode HTML entities from Open Trivia DB responses.
 * The API returns HTML-encoded strings by default.
 */
function decodeHTML(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&eacute;/g, 'é')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Eacute;/g, 'É')
    .replace(/&lrm;/g, '')
    .replace(/&rlm;/g, '')
    .replace(/&shy;/g, '')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013');
}

/**
 * Request a new session token from the API.
 * Tokens prevent repeat questions across multiple fetches.
 */
async function requestToken(): Promise<string | null> {
  try {
    const response = await fetch(`${OPENTDB_TOKEN}?command=request`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    const data: TokenResponse = await response.json();
    if (data.response_code === RESPONSE.SUCCESS && data.token) {
      console.log('[TriviaAPI] New session token acquired');
      return data.token;
    }
    return null;
  } catch (err) {
    console.warn('[TriviaAPI] Failed to get token:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Reset an existing token (clears the "already seen" list).
 * Called when the token is exhausted (response code 4).
 */
async function resetToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${OPENTDB_TOKEN}?command=reset&token=${token}`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    const data: TokenResponse = await response.json();
    return data.response_code === RESPONSE.SUCCESS;
  } catch {
    return false;
  }
}

/**
 * Ensure we have a valid session token.
 */
async function ensureToken(): Promise<string | null> {
  if (!sessionToken) {
    sessionToken = await requestToken();
  }
  return sessionToken;
}

/**
 * Fetch seed facts from Open Trivia DB.
 * Uses session tokens to avoid repeats across games.
 *
 * @param count Number of facts to fetch (1-50)
 * @param difficulty Optional difficulty filter
 * @param category Optional category ID (see https://opentdb.com/api_category.php)
 * @returns Array of normalized seed facts
 */
export async function fetchSeedFacts(
  count: number = 15,
  difficulty?: 'easy' | 'medium' | 'hard',
  category?: number
): Promise<SeedFact[]> {
  try {
    // Get or create session token
    const token = await ensureToken();

    const params = new URLSearchParams({
      amount: String(Math.min(count, 50)),
      type: 'multiple',
    });
    if (difficulty) params.set('difficulty', difficulty);
    if (category) params.set('category', String(category));
    if (token) params.set('token', token);

    const response = await fetch(`${OPENTDB_API}?${params}`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(`[TriviaAPI] HTTP ${response.status}`);
      return [];
    }

    const data: OpenTDBResponse = await response.json();

    // Handle response codes
    switch (data.response_code) {
      case RESPONSE.SUCCESS:
        break;

      case RESPONSE.TOKEN_EMPTY:
        // All questions exhausted for this token — reset and retry once
        console.log('[TriviaAPI] Token exhausted, resetting...');
        if (token && await resetToken(token)) {
          return fetchSeedFacts(count, difficulty, category);
        }
        return [];

      case RESPONSE.TOKEN_NOT_FOUND:
        // Token expired — request new one and retry once
        console.log('[TriviaAPI] Token expired, requesting new one...');
        sessionToken = await requestToken();
        if (sessionToken) {
          return fetchSeedFacts(count, difficulty, category);
        }
        return [];

      case RESPONSE.RATE_LIMIT:
        console.warn('[TriviaAPI] Rate limited (max 1 req per 5s)');
        return [];

      case RESPONSE.NO_RESULTS:
        console.warn('[TriviaAPI] Not enough questions for this query');
        return [];

      default:
        console.warn(`[TriviaAPI] Unexpected response code: ${data.response_code}`);
        return [];
    }

    return data.results.map((r) => ({
      category: decodeHTML(r.category),
      question: decodeHTML(r.question),
      correct_answer: decodeHTML(r.correct_answer),
      incorrect_answers: r.incorrect_answers.map(decodeHTML),
    }));
  } catch (err) {
    console.warn('[TriviaAPI] Failed to fetch:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Fetch facts from a mix of difficulties for variety.
 * Gets some easy, some medium, some hard.
 */
export async function fetchMixedDifficultyFacts(count: number = 15): Promise<SeedFact[]> {
  const easy = Math.ceil(count * 0.3);
  const medium = Math.ceil(count * 0.5);
  const hard = count - easy - medium;

  // Fetch all difficulties in parallel
  const [easyFacts, mediumFacts, hardFacts] = await Promise.all([
    fetchSeedFacts(easy, 'easy'),
    fetchSeedFacts(medium, 'medium'),
    fetchSeedFacts(hard, 'hard'),
  ]);

  // Combine and shuffle
  const all = [...easyFacts, ...mediumFacts, ...hardFacts];
  return all.sort(() => Math.random() - 0.5);
}

/**
 * Convert our seed-questions.json entries to the SeedFact format
 * so they can be fed to Claude the same way as Open Trivia DB facts.
 */
export function seedQuestionsToFacts(
  questions: { category: string; prompt: string; choices: string[]; correctIndex: number }[]
): SeedFact[] {
  return questions.map((q) => ({
    category: q.category,
    question: q.prompt,
    correct_answer: q.choices[q.correctIndex],
    incorrect_answers: q.choices.filter((_, i) => i !== q.correctIndex),
  }));
}
