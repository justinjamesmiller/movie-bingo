import { beforeAll, describe, expect, it, vi } from 'vitest';
import { areTropeDescriptionsLoaded, getTropeDescription, loadTropeDescriptions } from './tropeDescriptions.js';
import { TROPES } from './tropes.js';

describe('trope descriptions', () => {
  let descriptions;

  beforeAll(async () => {
    descriptions = await loadTropeDescriptions();
  });

  it('reads as empty until the lazy chunk has been fetched', async () => {
    vi.resetModules();
    const fresh = await import('./tropeDescriptions.js');
    expect(fresh.areTropeDescriptionsLoaded()).toBe(false);
    expect(fresh.getTropeDescription('Jump Scare')).toBeNull();

    await fresh.loadTropeDescriptions();
    expect(fresh.areTropeDescriptionsLoaded()).toBe(true);
    expect(fresh.getTropeDescription('Jump Scare')).not.toBeNull();
  });

  it('reuses the cached data rather than refetching', async () => {
    expect(areTropeDescriptionsLoaded()).toBe(true);
    expect(await loadTropeDescriptions()).toBe(descriptions);
  });

  it('returns null for a trope with no description (e.g. a custom submission)', () => {
    expect(getTropeDescription('A trope nobody has documented')).toBeNull();
    expect(getTropeDescription(undefined)).toBeNull();
  });

  it('returns the description for a documented trope', () => {
    expect(getTropeDescription('Jump Scare')).toMatchObject({
      what: expect.any(String),
      example: expect.any(String),
    });
  });

  it('only describes tropes that actually exist in the trope list', () => {
    const known = new Set(TROPES.map((t) => t.text));
    const orphans = Object.keys(descriptions).filter((text) => !known.has(text));
    expect(orphans).toEqual([]);
  });

  it('gives every description both an explanation and an example', () => {
    for (const [text, entry] of Object.entries(descriptions)) {
      expect(entry.what, `"${text}" is missing an explanation`).toBeTruthy();
      expect(entry.example, `"${text}" is missing an example`).toBeTruthy();
    }
  });

  it('covers every trope in the game, so no player ever sees a blank explanation', () => {
    const missing = TROPES.filter((t) => !getTropeDescription(t.text)).map((t) => `${t.genre}: ${t.text}`);
    expect(missing).toEqual([]);
  });
});
