/**
 * Constants for voice chat timing and configuration
 */

// Transcript deduplication timeout (ms)
export const TRANSCRIPT_DEDUP_TIMEOUT = 1500;

// Auto-restart delay after speech finishes (ms)
export const AUTO_RESTART_DELAY = 500;

// Geolocation timeout (ms)
export const GEOLOCATION_TIMEOUT = 2000;

// Geolocation cache age (ms) - 1 minute
export const GEOLOCATION_CACHE_AGE = 60000;

// Location promise race timeout (ms) - don't wait too long for location
export const LOCATION_RACE_TIMEOUT = 500;

// Maximum number of doctors to display
export const MAX_DOCTORS_DISPLAY = 5;

// Maximum number of availability slots to display
export const MAX_SLOTS_DISPLAY = 5;

// Maximum number of appointments to display in schedule
export const MAX_APPOINTMENTS_DISPLAY = 5;

// Maximum number of patient matches to display
export const MAX_PATIENT_MATCHES_DISPLAY = 3;

// Maximum number of stats buckets to display
export const MAX_STATS_BUCKETS_DISPLAY = 5;

// Speech recognition language
export const SPEECH_RECOGNITION_LANG = "en-US";

// Audio configuration
export const AUDIO_SAMPLE_RATE = 16000;
export const AUDIO_CHANNEL_COUNT = 1;
export const AUDIO_BUFFER_SIZE = 4096;

// Speech synthesis settings
export const SPEECH_RATE = 0.9;
export const SPEECH_PITCH = 1;
export const SPEECH_VOLUME = 1;

