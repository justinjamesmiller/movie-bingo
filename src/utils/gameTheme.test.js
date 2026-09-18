import { describe, expect, it } from 'vitest';
import { getGameTheme } from './gameTheme.js';

describe('getGameTheme', () => {
  it('uses the default horror theme when no game genres are available', () => {
    expect(getGameTheme()).toMatchObject({ accent: '#9f2637' });
  });

  it('uses a selected subgenre as the primary accent', () => {
    expect(getGameTheme(['horror'], [{ genre: 'horror', subgenre: 'supernatural' }])).toMatchObject({
      accent: '#7142a2',
    });
  });

  it('uses the second selected genre as an accent-hover color', () => {
    const theme = getGameTheme(['action', 'comedy']);
    expect(theme.accent).toBe('#176ea6');
    expect(theme.accentHover).toBe('#b65a00');
    expect(theme).not.toHaveProperty('wash');
  });

  it('keeps genre accents consistent across light and dark modes', () => {
    const theme = getGameTheme(['horror', 'fantasy'], [], 'dark');
    expect(theme.accent).toBe('#9f2637');
    expect(theme.accentHover).toBe('#6f4aa1');
  });
});
