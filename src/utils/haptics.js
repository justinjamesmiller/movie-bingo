// Mobile haptic feedback (navigator.vibrate) -- independently mutable from
// sound, persisted separately so a player can mute one without the other.
const MUTE_KEY = 'bingo-vibration-muted';

let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === 'true';
} catch {
  // localStorage may be unavailable (e.g. private browsing)
}

export function isVibrationMuted() {
  return muted;
}

export function setVibrationMuted(value) {
  muted = !!value;
  try {
    localStorage.setItem(MUTE_KEY, String(muted));
  } catch {
    // ignore
  }
}

export function vibrate(pattern) {
  if (muted) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(pattern);
}

export const VIBRATE_PATTERN_MARK = [40];
export const VIBRATE_PATTERN_BINGO = [80, 40, 80, 40, 160];
