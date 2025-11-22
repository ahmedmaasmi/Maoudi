/**
 * Eleven Labs Text-to-Speech Service
 * Uses Eleven Labs API for high-quality voice synthesis
 */

const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || "";
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
// Default voice ID for free tier (Rachel - natural, clear voice)
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice
// Note: Uses eleven_turbo_v2_5 model (free tier compatible)

export interface ElevenLabsOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

/**
 * Convert text to speech using Eleven Labs API
 * Returns audio data as ArrayBuffer
 */
export async function textToSpeech(
  text: string,
  options: ElevenLabsOptions = {}
): Promise<ArrayBuffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("Eleven Labs API key is not configured. Please set NEXT_PUBLIC_ELEVENLABS_API_KEY");
  }

  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  const url = `${ELEVENLABS_API_URL}/${voiceId}`;

  const requestBody = {
    text: text,
    model_id: options.modelId || "eleven_turbo_v2_5", // Free tier model (updated from deprecated eleven_monolingual_v1)
    voice_settings: {
      stability: options.stability ?? 0.5,
      similarity_boost: options.similarityBoost ?? 0.75,
      style: options.style ?? 0.0,
      use_speaker_boost: options.useSpeakerBoost ?? true,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Eleven Labs API error: ${response.status} - ${errorText}`);
    }

    const audioData = await response.arrayBuffer();
    return audioData;
  } catch (error) {
    console.error("Eleven Labs TTS error:", error);
    throw error;
  }
}

// Store current audio element for stopping
let currentAudioElement: HTMLAudioElement | null = null;

/**
 * Play audio from ArrayBuffer
 */
export function playAudio(audioBuffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      currentAudioElement = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (currentAudioElement === audio) {
          currentAudioElement = null;
        }
        resolve();
      };
      
      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        if (currentAudioElement === audio) {
          currentAudioElement = null;
        }
        reject(error);
      };
      
      audio.play().catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Stop currently playing audio
 */
export function stopAudio(): void {
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
    currentAudioElement = null;
  }
}

/**
 * Speak text using Eleven Labs TTS
 */
export async function speakWithElevenLabs(
  text: string,
  options: ElevenLabsOptions = {}
): Promise<void> {
  try {
    const audioBuffer = await textToSpeech(text, options);
    await playAudio(audioBuffer);
  } catch (error) {
    console.error("Failed to speak with Eleven Labs:", error);
    throw error;
  }
}

/**
 * Check if Eleven Labs is available (API key configured)
 */
export function isElevenLabsAvailable(): boolean {
  return !!ELEVENLABS_API_KEY;
}

