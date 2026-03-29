import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

/**
 * Get or create the Anthropic client.
 * Returns null if ANTHROPIC_API_KEY is not set.
 */
export function getClaudeClient(): Anthropic | null {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[Claude] ANTHROPIC_API_KEY not set — AI question generation disabled');
    return null;
  }

  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Check if Claude API is available.
 */
export function isClaudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
