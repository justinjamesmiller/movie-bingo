import { describe, expect, it } from 'vitest';
import { balancedRatios, ratioTotal, updateRatio } from './ratios.js';

describe('balancedRatios', () => {
  it('creates an even two-way split', () => {
    expect(balancedRatios(['general', 'slasher'])).toEqual({ general: 50, slasher: 50 });
  });

  it('keeps an uneven 10-percent split at exactly 100', () => {
    const ratios = balancedRatios(['general', 'slasher', 'supernatural']);
    expect(ratios).toEqual({ general: 40, slasher: 30, supernatural: 30 });
    expect(ratioTotal(ratios, Object.keys(ratios))).toBe(100);
  });

  it('distributes a six-way split as closely as possible', () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f'];
    const ratios = balancedRatios(keys);
    expect(Object.values(ratios).sort()).toEqual([10, 10, 20, 20, 20, 20]);
    expect(ratioTotal(ratios, keys)).toBe(100);
  });
});

describe('updateRatio', () => {
  it('moves the counterpart slider in a two-option set', () => {
    expect(updateRatio({ general: 50, slasher: 50 }, ['general', 'slasher'], 'general', 60)).toEqual({
      general: 60,
      slasher: 40,
    });
  });

  it('leaves other sliders unchanged in larger sets', () => {
    expect(updateRatio({ a: 40, b: 30, c: 30 }, ['a', 'b', 'c'], 'a', 60)).toEqual({ a: 60, b: 30, c: 30 });
  });
});
