/**
 * ElevenLabs TTS Client
 *
 * Converts host commentary text into spoken audio via ElevenLabs API.
 * Returns audio as a Buffer (MP3) that can be served to clients.
 */

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = '1t1EeRixsJrKbiF1zwM6';
const TTS_TIMEOUT_MS = 8000;

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.6,
  similarity_boost: 0.8,
  style: 0.4,
  use_speaker_boost: true,
};

/**
 * Check if ElevenLabs is configured.
 */
export function isVoiceEnabled(): boolean {
  const enabled = !!process.env.ELEVENLABS_API_KEY;
  if (!enabled) {
    console.log('[ElevenLabs] Voice disabled — no ELEVENLABS_API_KEY set');
  }
  return enabled;
}

/**
 * Generate speech audio from text using ElevenLabs.
 * Returns an MP3 buffer, or null if generation fails.
 */
export async function generateSpeech(
  text: string,
  voiceId?: string
): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return null;
  }

  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  try {
    const response = await fetch(
      `${ELEVENLABS_API}/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: DEFAULT_VOICE_SETTINGS,
        }),
        signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      console.error(`[ElevenLabs] HTTP ${response.status}: ${errorText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`[ElevenLabs] Generated ${Math.round(arrayBuffer.byteLength / 1024)}KB audio for: "${text.substring(0, 50)}..."`);
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('[ElevenLabs] TTS failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Generate speech and return as a base64-encoded data URL.
 * This can be sent directly to clients via Socket.io.
 */
export async function generateSpeechDataUrl(
  text: string,
  voiceId?: string
): Promise<string | null> {
  const buffer = await generateSpeech(text, voiceId);
  if (!buffer) return null;
  return `data:audio/mpeg;base64,${buffer.toString('base64')}`;
}
