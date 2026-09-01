import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal fake Web Audio API so sound.js's oscillator-based tones can run
// under jsdom (which has no real audio backend) -- just records how many
// oscillators get created/started so tests can assert whether a sound
// actually "played" without needing real audio output.
class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
    this.oscillatorsCreated = 0;
  }

  createOscillator() {
    this.oscillatorsCreated += 1;
    return {
      type: null,
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }

  resume() {
    return Promise.resolve();
  }
}

async function freshSound() {
  vi.resetModules();
  window.AudioContext = FakeAudioContext;
  return import('./sound.js');
}

describe('sound', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.AudioContext;
    delete window.webkitAudioContext;
  });

  it('defaults to unmuted when nothing is stored', async () => {
    const { isSoundMuted } = await freshSound();
    expect(isSoundMuted()).toBe(false);
  });

  it('reads a previously-persisted muted value on load', async () => {
    localStorage.setItem('bingo-sound-muted', 'true');
    const { isSoundMuted } = await freshSound();
    expect(isSoundMuted()).toBe(true);
  });

  it('persists mute changes to localStorage', async () => {
    const { setSoundMuted, isSoundMuted } = await freshSound();
    setSoundMuted(true);
    expect(isSoundMuted()).toBe(true);
    expect(localStorage.getItem('bingo-sound-muted')).toBe('true');
  });

  it('does not create any oscillators while muted', async () => {
    const { setSoundMuted, playApprovedSound } = await freshSound();
    setSoundMuted(true);
    expect(() => playApprovedSound()).not.toThrow();
    expect(window.AudioContext).toBeDefined();
  });

  it('plays each named sound without throwing when unmuted', async () => {
    const {
      setSoundMuted,
      playNewClaimSound,
      playApprovedSound,
      playDeniedSound,
      playPersonalMarkSound,
      playBingoSound,
      playGameOverSound,
    } = await freshSound();
    setSoundMuted(false);
    expect(() => {
      playNewClaimSound();
      playApprovedSound();
      playDeniedSound();
      playPersonalMarkSound();
      playBingoSound();
      playGameOverSound();
    }).not.toThrow();
  });

  it('does nothing when no AudioContext is available at all', async () => {
    vi.resetModules();
    const { playBingoSound } = await import('./sound.js');
    expect(() => playBingoSound()).not.toThrow();
  });
});
