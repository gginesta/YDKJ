/**
 * Claude API Client
 *
 * Wrapper around the Anthropic SDK for question generation
 * and host commentary. Handles retries, validation, and fallbacks.
 */

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

/**
 * Get or create the Anthropic client.
 * Returns null if no API key is configured.
 */
export function getClient(): Anthropic | null {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[Claude] No ANTHROPIC_API_KEY set — AI features disabled, using seed questions');
    return null;
  }

  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Generate text with Claude. Used for host commentary.
 */
export async function generateText(
  systemPrompt: string,
  userMessage: string
): Promise<string | null> {
  const api = getClient();
  if (!api) return null;

  try {
    const response = await api.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock ? textBlock.text : null;
  } catch (err) {
    console.error('[Claude] Text generation failed:', err);
    return null;
  }
}

export interface ToolCallResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

/**
 * Generate structured output with Claude using tool use.
 * Used for question generation — guarantees JSON schema compliance.
 *
 * Retries once on failure.
 */
export async function generateWithTool<T>(
  systemPrompt: string,
  userMessage: string,
  tool: Anthropic.Tool,
  maxRetries: number = 1
): Promise<ToolCallResult<T>> {
  const api = getClient();
  if (!api) return { success: false, data: null, error: 'No API key configured' };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await api.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
      });

      const toolBlock = response.content.find((b) => b.type === 'tool_use');
      if (!toolBlock || toolBlock.type !== 'tool_use') {
        if (attempt < maxRetries) {
          console.warn(`[Claude] No tool call in response, retrying (${attempt + 1}/${maxRetries})`);
          continue;
        }
        return { success: false, data: null, error: 'No tool call in response' };
      }

      return { success: true, data: toolBlock.input as T };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Claude] Tool generation failed (attempt ${attempt + 1}):`, message);

      if (attempt < maxRetries) continue;
      return { success: false, data: null, error: message };
    }
  }

  return { success: false, data: null, error: 'Max retries exceeded' };
}
