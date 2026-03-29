/**
 * ElevenLabs TTS client for host voice synthesis.
 *
 * Generates MP3 audio from host scripts via the ElevenLabs streaming API.
 * Returns audio as a base64-encoded string for sending to clients via Socket.io.
 */

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

interface VoiceConfig {
  voiceId: string;
  modelId: string;
  voiceSettings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
  outputFormat: string;
}

const DEFAULT_CONFIG: Omit<VoiceConfig, 'voiceId'> = {
  modelId: 'eleven_turbo_v2',
  voiceSettings: {
    stability: 0.6,
    similarity_boost: 0.8,
    style: 0.4,
    use_speaker_boost: true,
  },
  outputFormat: 'mp3_44100_128',
};

/**
 * Check if ElevenLabs TTS is available (API key + voice ID configured).
 */
export function isTTSAvailable(): boolean {
  return !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
}

/**
 * Generate speech audio from text.
 * Returns base64-encoded MP3 audio, or null on failure.
 */
export async function generateSpeech(text: string): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return null;
  }

  // Skip empty or very short text
  if (!text || text.trim().length < 3) {
    return null;
  }

  try {
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: DEFAULT_CONFIG.modelId,
          voice_settings: DEFAULT_CONFIG.voiceSettings,
        }),
      }
    );

    if (!response.ok) {
      console.error(`[ElevenLabs] TTS failed: ${response.status} ${response.statusText}`);
      return null;
    }

    // Convert response to base64
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return base64;
  } catch (err) {
    console.error('[ElevenLabs] TTS error:', err);
    return null;
  }
}

/**
 * Generate speech with a timeout.
 * If TTS takes longer than timeoutMs, returns null (text fallback will be used).
 */
export async function generateSpeechWithTimeout(
  text: string,
  timeoutMs: number = 4000
): Promise<string | null> {
  return Promise.race([
    generateSpeech(text),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}
