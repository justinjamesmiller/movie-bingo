// Plain-language explanations shown before a player submits a trope for group
// approval, so everyone is judging the same thing. Keys are trope texts, which
// are shared across genres wherever the same text appears in more than one.
//
// The descriptions are several hundred KB, so they're fetched on demand rather
// than shipped in the initial bundle. Call loadTropeDescriptions() early (the
// app warms it as soon as a game is on screen) and read synchronously after.
let cache = null;
let pending = null;

export function loadTropeDescriptions() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = import('./descriptions/index.js')
      .then((module) => {
        cache = module.default;
        pending = null;
        return cache;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

export function areTropeDescriptionsLoaded() {
  return cache !== null;
}

export function getTropeDescription(text) {
  return (text && cache?.[text]) || null;
}
