/**
 * Audio Cache — Tier 1 Pre-Generation
 *
 * Batch-generates TTS audio for all known host scripts during the
 * loading phase. Stores results in memory for instant playback
 * during game phases.
 *
 * Uses bounded concurrency to avoid ElevenLabs rate limits.
 */

import { generateSpeechDataUrl, isVoiceEnabled } from './elevenlabs-client';

export interface AudioEntry {
  key: string;
  text: string;
}

export type ProgressCallback = (completed: number, total: number) => void;

const CONCURRENCY_LIMIT = 5;
const BATCH_TIMEOUT_MS = 16000;

export class AudioCache {
  private cache = new Map<string, string>();
  private generating = false;

  /**
   * Batch-generate TTS audio for a list of text entries.
   * Runs with bounded concurrency and a master timeout.
   * Calls onProgress after each clip completes.
   */
  async generateBatch(
    entries: AudioEntry[],
    onProgress?: ProgressCallback
  ): Promise<void> {
    if (!isVoiceEnabled() || entries.length === 0) {
      onProgress?.(0, 0);
      return;
    }

    this.generating = true;
    const total = entries.length;
    let completed = 0;

    onProgress?.(0, total);

    // Create task functions
    const tasks = entries.map((entry) => async () => {
      if (!this.generating) return; // cancelled
      try {
        const audioUrl = await generateSpeechDataUrl(entry.text);
        if (audioUrl) {
          this.cache.set(entry.key, audioUrl);
        }
      } catch {
        // Individual failure is fine — text fallback works
      }
      completed++;
      onProgress?.(completed, total);
    });

    // Run with concurrency limit + master timeout
    const batchPromise = this.runWithConcurrency(tasks, CONCURRENCY_LIMIT);
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, BATCH_TIMEOUT_MS)
    );

    await Promise.race([batchPromise, timeoutPromise]);
    this.generating = false;

    console.log(`[AudioCache] Cached ${this.cache.size}/${total} audio clips`);
  }

  /**
   * Get a cached audio data URL by key.
   */
  get(key: string): string | null {
    return this.cache.get(key) || null;
  }

  /**
   * Check how many clips are cached.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Clear the cache (on game reset / destroy).
   */
  clear(): void {
    this.generating = false;
    this.cache.clear();
  }

  /**
   * Run async tasks with a concurrency limit.
   */
  private async runWithConcurrency(
    tasks: (() => Promise<void>)[],
    limit: number
  ): Promise<void> {
    const executing = new Set<Promise<void>>();

    for (const task of tasks) {
      if (!this.generating) break;

      const p = task().then(() => {
        executing.delete(p);
      });
      executing.add(p);

      if (executing.size >= limit) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
  }
}

/**
 * Build the list of audio entries to pre-generate from loaded questions.
 */
export function buildAudioEntries(
  gameIntroText: string,
  questions: {
    id: string;
    hostIntro: string;
    hostCorrect: string;
    hostWrong: string;
    hostTimeout: string;
  }[],
  roundTransitionText: string,
  gameOverText: string
): AudioEntry[] {
  const entries: AudioEntry[] = [
    { key: 'intro', text: gameIntroText },
  ];

  for (const q of questions) {
    entries.push({ key: `q_${q.id}_intro`, text: q.hostIntro });
    entries.push({ key: `q_${q.id}_correct`, text: q.hostCorrect });
    entries.push({ key: `q_${q.id}_wrong`, text: q.hostWrong });
    entries.push({ key: `q_${q.id}_timeout`, text: q.hostTimeout });
  }

  entries.push({ key: 'round2_transition', text: roundTransitionText });
  entries.push({ key: 'game_over', text: gameOverText });

  return entries;
}
