// Lightweight Web Audio API notification sounds -- no audio file assets
// needed (keeps the app fully self-contained/offline-friendly), just short
// synthesized tones. Mute state persists to localStorage.
const MUTE_KEY = 'bingo-sound-muted';

let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === 'true';
} catch {
  // localStorage may be unavailable (e.g. private browsing)
}

let audioCtx = null;

export function isSoundMuted() {
  return muted;
}

export function setSoundMuted(value) {
  muted = !!value;
  try {
    localStorage.setItem(MUTE_KEY, String(muted));
  } catch {
    // ignore
  }
}

function getContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(ctx, freq, startTime, duration, type, gainValue) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Each note is [frequency, startOffset, duration, waveType, gain].
function playNotes(notes) {
  if (muted) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const [freq, offset, duration, type, gain] of notes) {
    tone(ctx, freq, now + offset, duration, type, gain);
  }
}

// Deliberately the most attention-grabbing cue in the app -- it's the only one
// that asks the player to actually do something.
export function playNewClaimSound() {
  playNotes([
    [740, 0, 0.14, 'triangle', 0.18],
    [988, 0.16, 0.22, 'triangle', 0.18],
  ]);
}

export function playApprovedSound() {
  playNotes([
    [520, 0, 0.1, 'sine', 0.14],
    [780, 0.1, 0.16, 'sine', 0.14],
  ]);
}

export function playDeniedSound() {
  playNotes([[300, 0, 0.2, 'sawtooth', 0.1]]);
}

// A bigger celebratory chime for approvals that land on YOUR OWN board (or
// your own submission getting approved) -- distinct from the plain
// `playApprovedSound` used for approvals that don't personally affect you.
export function playPersonalMarkSound() {
  playNotes([
    [587.33, 0, 0.12, 'triangle', 0.16],
    [739.99, 0.1, 0.12, 'triangle', 0.16],
    [880, 0.2, 0.22, 'triangle', 0.18],
  ]);
}

export function playBingoSound() {
  playNotes([
    [523.25, 0, 0.14, 'triangle', 0.16],
    [659.25, 0.12, 0.14, 'triangle', 0.16],
    [783.99, 0.24, 0.14, 'triangle', 0.16],
    [1046.5, 0.36, 0.32, 'triangle', 0.18],
  ]);
}

export function playGameOverSound() {
  playNotes([
    [660, 0, 0.16, 'sine', 0.14],
    [523.25, 0.16, 0.16, 'sine', 0.14],
    [440, 0.32, 0.3, 'sine', 0.14],
  ]);
}
