import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The base title is captured when the module first loads, so set it before
// importing and reset the module between tests.
async function freshTabAlert(baseTitle = 'Movie/TV Trope Bingo') {
  document.title = baseTitle;
  vi.resetModules();
  return import('./tabAlert.js');
}

describe('tabAlert', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the alert message immediately', async () => {
    const { setTabAlert } = await freshTabAlert();
    setTabAlert('🔔 Your answer is needed!');
    expect(document.title).toBe('🔔 Your answer is needed!');
  });

  it('alternates between the alert and the original title', async () => {
    const { setTabAlert } = await freshTabAlert('Movie/TV Trope Bingo');
    setTabAlert('🔔 Your answer is needed!');

    vi.advanceTimersByTime(1000);
    expect(document.title).toBe('Movie/TV Trope Bingo');

    vi.advanceTimersByTime(1000);
    expect(document.title).toBe('🔔 Your answer is needed!');
  });

  it('restores the original title and stops flashing when cleared', async () => {
    const { setTabAlert, clearTabAlert } = await freshTabAlert('Movie/TV Trope Bingo');
    setTabAlert('🔔 Your answer is needed!');
    clearTabAlert();

    expect(document.title).toBe('Movie/TV Trope Bingo');
    vi.advanceTimersByTime(5000);
    expect(document.title).toBe('Movie/TV Trope Bingo');
  });

  it('does not stack timers when the alert is set repeatedly', async () => {
    const { setTabAlert, clearTabAlert } = await freshTabAlert('Movie/TV Trope Bingo');
    setTabAlert('🔔 Your answer is needed!');
    setTabAlert('🔔 Your answer is needed!');
    setTabAlert('🔔 Your answer is needed!');

    vi.advanceTimersByTime(1000);
    expect(document.title).toBe('Movie/TV Trope Bingo');

    clearTabAlert();
    vi.advanceTimersByTime(5000);
    expect(document.title).toBe('Movie/TV Trope Bingo');
  });

  it('ignores an empty message', async () => {
    const { setTabAlert } = await freshTabAlert('Movie/TV Trope Bingo');
    setTabAlert('');
    vi.advanceTimersByTime(3000);
    expect(document.title).toBe('Movie/TV Trope Bingo');
  });

  it('is safe to clear when no alert is active', async () => {
    const { clearTabAlert } = await freshTabAlert('Movie/TV Trope Bingo');
    expect(() => clearTabAlert()).not.toThrow();
    expect(document.title).toBe('Movie/TV Trope Bingo');
  });
});
