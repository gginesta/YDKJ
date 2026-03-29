/**
 * Client-side voice player for host TTS audio.
 *
 * Handles Web Audio API playback of base64-encoded MP3 audio
 * delivered via Socket.io events. Queues audio to prevent overlap.
 */

let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let isPlaying = false;
const audioQueue: string[] = [];

/**
 * Initialize the AudioContext. Must be called after a user gesture
 * (e.g., button click) to comply with browser autoplay policies.
 */
export function initAudioContext(): void {
  if (audioContext) return;
  try {
    audioContext = new AudioContext();
  } catch (err) {
    console.warn('[VoicePlayer] Failed to create AudioContext:', err);
  }
}

/**
 * Resume the audio context (required after user gesture on iOS Safari).
 */
export async function resumeAudioContext(): Promise<void> {
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

/**
 * Play audio from a data URL (base64-encoded MP3).
 * Queues if another audio is already playing.
 */
export function playAudio(dataUrl: string): void {
  if (!dataUrl) return;

  // Initialize on first play attempt
  if (!audioContext) initAudioContext();

  audioQueue.push(dataUrl);
  if (!isPlaying) {
    processQueue();
  }
}

/**
 * Stop all audio playback and clear the queue.
 */
export function stopAllAudio(): void {
  audioQueue.length = 0;
  if (currentSource) {
    try {
      currentSource.stop();
    } catch { /* already stopped */ }
    currentSource = null;
  }
  isPlaying = false;
}

/**
 * Check if voice playback is supported.
 */
export function isVoiceSupported(): boolean {
  return typeof AudioContext !== 'undefined' || typeof (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext !== 'undefined';
}

// ============================================================
// Internal
// ============================================================

async function processQueue(): Promise<void> {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }

  isPlaying = true;
  const dataUrl = audioQueue.shift()!;

  try {
    if (!audioContext) {
      isPlaying = false;
      return;
    }

    // Resume if suspended (iOS)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Decode base64 data URL to ArrayBuffer
    const base64 = dataUrl.replace(/^data:audio\/mpeg;base64,/, '');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);

    // Play
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    currentSource = source;

    source.onended = () => {
      currentSource = null;
      processQueue(); // Play next in queue
    };

    source.start(0);
  } catch (err) {
    console.warn('[VoicePlayer] Playback error:', err);
    currentSource = null;
    processQueue(); // Skip failed audio, continue queue
  }
}
