export type EqualizerBand = {
  frequency: number;
  label: string;
  gain: number; // -12dB to +12dB
};

export type EqualizerPreset =
  | "flat"
  | "bass_boost"
  | "vocal_boost"
  | "treble_boost"
  | "rock"
  | "pop"
  | "electronic"
  | "jazz"
  | "classical"
  | "acoustic"
  | "hiphop"
  | "custom";

export const EQUALIZER_FREQUENCIES = [
  { frequency: 32, label: "32Hz" },
  { frequency: 64, label: "64Hz" },
  { frequency: 125, label: "125Hz" },
  { frequency: 250, label: "250Hz" },
  { frequency: 500, label: "500Hz" },
  { frequency: 1000, label: "1kHz" },
  { frequency: 2000, label: "2kHz" },
  { frequency: 4000, label: "4kHz" },
  { frequency: 8000, label: "8kHz" },
  { frequency: 16000, label: "16kHz" },
];

export const EQUALIZER_PRESETS: Record<EqualizerPreset, { name: string; gains: number[] }> = {
  flat: {
    name: "Flat",
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  bass_boost: {
    name: "Bass Boost",
    gains: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
  },
  vocal_boost: {
    name: "Vocal Boost",
    gains: [-2, -2, -1, 1, 4, 5, 4, 2, 0, -1],
  },
  treble_boost: {
    name: "Treble Boost",
    gains: [0, 0, 0, 0, 1, 2, 4, 6, 7, 8],
  },
  rock: {
    name: "Rock",
    gains: [5, 4, 3, 1, -1, -1, 1, 3, 5, 6],
  },
  pop: {
    name: "Pop",
    gains: [-1, 1, 3, 4, 3, 0, -1, 1, 3, 4],
  },
  electronic: {
    name: "Electronic",
    gains: [6, 5, 3, 0, -2, 1, 2, 4, 6, 6],
  },
  jazz: {
    name: "Jazz",
    gains: [3, 2, 1, 2, -1, -1, 0, 2, 3, 4],
  },
  classical: {
    name: "Classical",
    gains: [4, 3, 2, 1, -1, -1, 0, 2, 4, 5],
  },
  acoustic: {
    name: "Acoustic",
    gains: [3, 2, 1, 1, 2, 2, 3, 3, 4, 3],
  },
  hiphop: {
    name: "Hip Hop",
    gains: [6, 6, 4, 1, -1, 0, 1, 2, 4, 4],
  },
  custom: {
    name: "Custom",
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
};

export type AudioQuality = "saver" | "standard" | "high";

export type EqualizerSettings = {
  enabled: boolean;
  preset: EqualizerPreset;
  gains: number[];
  crossfade: number; // in seconds (0 = off, 1-8)
  quality: AudioQuality;
};

export const DEFAULT_EQUALIZER_SETTINGS: EqualizerSettings = {
  enabled: true,
  preset: "bass_boost",
  gains: EQUALIZER_PRESETS.bass_boost.gains,
  crossfade: 3,
  quality: "high",
};

const STORAGE_KEY = "melodymap.equalizer.v2";

export function loadEqualizerSettings(): EqualizerSettings {
  if (typeof window === "undefined") return DEFAULT_EQUALIZER_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EQUALIZER_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_EQUALIZER_SETTINGS,
      ...parsed,
      gains: Array.isArray(parsed.gains) && parsed.gains.length === 10 ? parsed.gains : DEFAULT_EQUALIZER_SETTINGS.gains,
    };
  } catch {
    return DEFAULT_EQUALIZER_SETTINGS;
  }
}

export function saveEqualizerSettings(settings: EqualizerSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota error
  }
}
