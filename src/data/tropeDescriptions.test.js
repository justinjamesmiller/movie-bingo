import { beforeAll, describe, expect, it, vi } from 'vitest';
import { areTropeDescriptionsLoaded, getTropeDescription, loadTropeDescriptions } from './tropeDescriptions.js';
import { TROPES } from './tropes.js';
import { SHARED_TROPE_DESCRIPTIONS } from './sharedTropes.js';

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

  it('describes renamed general beats without an arbitrary genre context', () => {
    expect(getTropeDescription('Wrong turn')).toEqual({
      what: 'A scene where a choice of direction or strategy makes everything worse.',
      example: 'Someone insists they know the way, then immediately proves they do not.',
    });
    expect(getTropeDescription('Adventure wrong turn')).toBeNull();
  });

  it('names the earlier-object weapon payoff explicitly and preserves its meaning', () => {
    const trope = TROPES.find((entry) => entry.text === 'Earlier object becomes a weapon');
    expect(trope?.subgenresByGenre.horror).toContain('slasher');
    expect(getTropeDescription(trope.text)).toEqual({
      what: 'An ordinary object established earlier comes back as a weapon.',
      example: 'The garden shears from the opening montage.',
    });
    expect(TROPES.some((entry) => entry.text === 'A familiar weapon')).toBe(false);
    expect(getTropeDescription('A familiar weapon')).toBeNull();
  });

  it('replaces the niche general locked-room mystery with an observable refusal to answer', () => {
    const trope = TROPES.find((entry) => entry.text === 'Someone refuses to answer');
    expect(trope?.subgenresByGenre.thriller).toEqual(['general']);
    expect(getTropeDescription('Someone refuses to answer')).toEqual({
      what: 'A character responds to a direct question by refusing to answer or deliberately remaining silent.',
      example: 'Asked where the missing person is, someone replies, "I am not telling you."',
    });
    expect(TROPES.some((entry) => entry.text === 'A locked room mystery')).toBe(false);
    expect(getTropeDescription('A locked room mystery')).toBeNull();
  });

  it.each([
    [
      'A train-top fight scene',
      'A fight knocks furniture over',
      'action',
      'A fight causes a table, chair, shelf, or other piece of furniture to topple over.',
      'A scuffle sends a chair toppling and tips a table onto its side.',
    ],
    [
      'An underwater escape scene',
      'Someone hides during a chase',
      'action',
      'A pursued character hides to avoid being seen or caught.',
      'Someone ducks behind a parked van while their pursuer runs past.',
    ],
    [
      'Terraforming a new planet',
      'A warning flashes on screen',
      'sci-fi',
      'A warning or error message flashes up on a device, monitor, or control panel.',
      'A console interrupts the crew with a red "SYSTEM FAILURE" warning.',
    ],
    [
      'A galaxy-spanning conflict',
      'Someone questions the mission',
      'sci-fi',
      'A character openly questions the purpose, necessity, or safety of their mission.',
      'A crew member asks, "Why are we risking our lives for this?"',
    ],
    [
      'An unexpected celebrity cameo',
      'Someone tries to hide laughter',
      'comedy',
      'A character visibly tries not to laugh or conceals their laughter from someone else.',
      'Someone covers their mouth and turns away while trying not to laugh during a serious speech.',
    ],
    [
      'A proposal under the stars',
      'Someone proposes marriage',
      'romance',
      'A character asks another person to marry them, regardless of the setting or the answer.',
      'During a conversation at home, someone asks, "Will you marry me?"',
    ],
    [
      'A love letter found decades later',
      'An old message is rediscovered',
      'romance',
      'A character comes across a previously overlooked or forgotten letter, text, email, or recorded message.',
      'While scrolling through old texts, someone finds a message they had forgotten about.',
    ],
    [
      'A talking animal reaction shot',
      'An animal reacts like a person',
      'comedy',
      'An animal reacts to a situation as though it understands human behavior; it does not have to speak.',
      'The dog raises an eyebrow at the excuse.',
    ],
  ])('replaces "%s" with "%s" while preserving its general genre membership', (oldText, text, genre, what, example) => {
    const trope = TROPES.find((entry) => entry.text === text);
    expect(trope?.subgenresByGenre[genre]).toEqual(['general']);
    expect(getTropeDescription(text)).toEqual({ what, example });
    expect(TROPES.some((entry) => entry.text === oldText)).toBe(false);
    expect(getTropeDescription(oldText)).toBeNull();
  });

  it.each([
    'Unconvincing visual effects',
    '"How did they film that?"',
    'Killer appears impossibly far ahead',
    'A swerve causes a crash',
    'Misses an obvious hint',
    'An everyday object becomes deadly',
    'A continuity error',
    "Something doesn't fit the period",
    'An implausible explosion',
    'Celebrates too soon',
    '"This isn\'t funny, guys."',
    'Heavy-handed foreshadowing',
    'Destroyed object returns intact',
    'Unwanted attention persists',
    'An ominous phone ring',
    'A woman is called a bitch',
    'Police dismiss a disappearance',
  ])('documents the approved candidate "%s" exactly once with valid memberships', (text) => {
    const entries = TROPES.filter((trope) => trope.text === text);
    expect(entries).toHaveLength(1);
    expect(entries[0].genreTags.length).toBeGreaterThan(0);
    expect(getTropeDescription(text)).toEqual(SHARED_TROPE_DESCRIPTIONS[text]);
    expect(getTropeDescription(text).what).toBeTruthy();
    expect(getTropeDescription(text).example).toBeTruthy();
  });

  it('merges the overlapping explosion parody into the approved optional explosion concept', () => {
    expect(TROPES.some((trope) => trope.text === 'An over-the-top explosion parody')).toBe(false);
    expect(getTropeDescription('An over-the-top explosion parody')).toBeNull();
    expect(TROPES.find((trope) => trope.text === 'An implausible explosion').optional).toBe(true);
  });

  it.each([
    ['Product placement', true, 'tv', 'lifestyle'],
    ['A fictional business is named', false, 'sci-fi', 'dystopian'],
    ['A montage', false, 'sport', 'underdog-story'],
    ['Bullying', false, 'comedy', 'workplace'],
    ['A slur is used', true, 'documentary', 'true-crime'],
    ['An old verse is quoted', false, 'horror', 'psychological'],
    ['An ominous warning', false, 'horror', 'creature'],
    ['Alcohol, tobacco, or drugs are used', true, 'music', 'music-industry'],
    ['A scene in a burial ground', false, 'horror', 'supernatural'],
    ['A relationship switches sides', false, 'comedy', 'buddy-comedy'],
  ])('defines the new approved trope "%s" with its preset policy and placement', (text, optional, genre, subgenre) => {
    const entries = TROPES.filter((trope) => trope.text === text);
    expect(entries).toHaveLength(1);
    expect(entries[0].optional).toBe(optional);
    expect(entries[0].subgenresByGenre[genre]).toContain(subgenre);
    expect(getTropeDescription(text)).toEqual(SHARED_TROPE_DESCRIPTIONS[text]);
    expect(getTropeDescription(text).what).toBeTruthy();
    expect(getTropeDescription(text).example).toBeTruthy();
  });

  it.each([
    ['A cemetery', 'A scene in a burial ground', 'horror', 'supernatural'],
    ["A local's dire warning", 'An ominous warning', 'horror', 'creature'],
    ['A rivalry turns friendly', 'A relationship switches sides', 'comedy', 'buddy-comedy'],
  ])('broadens "%s" into "%s" without a duplicate or orphan description', (oldText, text, genre, subgenre) => {
    expect(TROPES.some((trope) => trope.text === oldText)).toBe(false);
    expect(getTropeDescription(oldText)).toBeNull();
    expect(TROPES.find((trope) => trope.text === text).subgenresByGenre[genre]).toContain(subgenre);
  });

  it('makes both directions of the relationship switch explicit', () => {
    const description = getTropeDescription('A relationship switches sides');
    expect(description.what).toContain('friends or allies become openly opposed');
    expect(description.what).toContain('established opponents willingly cooperate');
    expect(description.example).toContain('Former friends');
    expect(description.example).toContain('two enemies');
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

  it('uses the canonical descriptions for shared tropes', () => {
    for (const [text, entry] of Object.entries(SHARED_TROPE_DESCRIPTIONS)) {
      expect(descriptions[text]).toEqual(entry);
    }
  });
});
