import { beforeEach, describe, expect, it, vi } from 'vitest';

// Each module under test keeps its mute flag as top-level mutable state
// initialized once at import time, so we reset the module registry between
// tests to get a fresh, independent instance every time.
async function freshHaptics() {
  vi.resetModules();
  return import('./haptics.js');
}

describe('haptics', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to unmuted when nothing is stored', async () => {
    const { isVibrationMuted } = await freshHaptics();
    expect(isVibrationMuted()).toBe(false);
  });

  it('reads a previously-persisted muted value on load', async () => {
    localStorage.setItem('bingo-vibration-muted', 'true');
    const { isVibrationMuted } = await freshHaptics();
    expect(isVibrationMuted()).toBe(true);
  });

  it('persists mute changes to localStorage', async () => {
    const { setVibrationMuted, isVibrationMuted } = await freshHaptics();
    setVibrationMuted(true);
    expect(isVibrationMuted()).toBe(true);
    expect(localStorage.getItem('bingo-vibration-muted')).toBe('true');
  });

  it('does not call navigator.vibrate while muted', async () => {
    const { setVibrationMuted, vibrate } = await freshHaptics();
    navigator.vibrate = vi.fn();
    setVibrationMuted(true);
    vibrate([50]);
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it('calls navigator.vibrate with the given pattern while unmuted', async () => {
    const { setVibrationMuted, vibrate } = await freshHaptics();
    navigator.vibrate = vi.fn();
    setVibrationMuted(false);
    vibrate([50, 20]);
    expect(navigator.vibrate).toHaveBeenCalledWith([50, 20]);
  });

  it('does nothing if navigator.vibrate is unavailable', async () => {
    const { vibrate } = await freshHaptics();
    const original = navigator.vibrate;
    delete navigator.vibrate;
    expect(() => vibrate([1])).not.toThrow();
    navigator.vibrate = original;
  });
});
