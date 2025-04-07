export const BASE_FREQ = 400;
export const STEP = 10;
export const MESSAGE_START = "~";
export const MESSAGE_END = "^";
export const CHAR_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ";

// Build the mapping for encoder (char → frequency)
export const charToFreqMap = {};
// And for decoder (frequency → char)
export const freqToCharMap = {};

CHAR_SET.split('').forEach((char, i) => {
  const freq = BASE_FREQ + i * STEP;
  charToFreqMap[char] = freq;
  freqToCharMap[Math.round(freq)] = char;
});

// Helper to get the closest matching character (tolerance of ±7 Hz)
export function getClosestChar(detectedFreq, tolerance = 7) {
  let best = null;
  let bestDiff = Infinity;
  for (const [freqStr, char] of Object.entries(freqToCharMap)) {
    const freq = Number(freqStr);
    const diff = Math.abs(detectedFreq - freq);
    if (diff < bestDiff && diff <= tolerance) {
      bestDiff = diff;
      best = char;
    }
  }
  return best;
}
