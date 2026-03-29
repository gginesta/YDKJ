/**
 * Open Trivia DB Integration
 *
 * Fetches verified trivia facts to use as seeds for Claude.
 * These facts are accurate — Claude rewrites the framing/humor,
 * not the facts themselves. This prevents hallucination.
 */

import type { SeedFact } from './prompts/question-generation';

const OPENTDB_URL = 'https://opentdb.com/api.php';

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

/**
 * Decode HTML entities from Open Trivia DB responses.
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
    .replace(/&uuml;/g, 'ü');
}

/**
 * Fetch seed facts from Open Trivia DB.
 *
 * @param count Number of facts to fetch (default 15)
 * @param difficulty Optional difficulty filter
 * @returns Array of normalized seed facts
 */
export async function fetchSeedFacts(
  count: number = 15,
  difficulty?: 'easy' | 'medium' | 'hard'
): Promise<SeedFact[]> {
  try {
    const params = new URLSearchParams({
      amount: String(count),
      type: 'multiple',
    });
    if (difficulty) params.set('difficulty', difficulty);

    const response = await fetch(`${OPENTDB_URL}?${params}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`[TriviaAPI] HTTP ${response.status}`);
      return [];
    }

    const data: OpenTDBResponse = await response.json();

    if (data.response_code !== 0) {
      console.warn(`[TriviaAPI] API response code: ${data.response_code}`);
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
