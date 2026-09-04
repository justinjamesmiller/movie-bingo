export const RATIO_OPTIONS = Array.from({ length: 11 }, (_, index) => index * 10);

// Creates the closest balanced 10-percent split that still totals exactly 100.
export function balancedRatios(keys) {
  if (keys.length === 0) return {};
  const base = Math.floor(100 / keys.length / 10) * 10;
  let remainder = 100 - base * keys.length;
  return Object.fromEntries(
    keys.map((key) => {
      const value = base + (remainder >= 10 ? 10 : 0);
      remainder -= 10;
      return [key, value];
    }),
  );
}

export function ratioTotal(ratios, keys) {
  return keys.reduce((total, key) => total + (Number(ratios[key]) || 0), 0);
}

// With two options, the other slider can always absorb the inverse change.
export function updateRatio(ratios, keys, changedKey, value) {
  const next = { ...ratios, [changedKey]: value };
  if (keys.length === 2) {
    const otherKey = keys.find((key) => key !== changedKey);
    next[otherKey] = 100 - value;
  }
  return next;
}
