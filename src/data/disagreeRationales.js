// Optional, anonymous reasons a voter can attach to a "disagree" vote.
// Shared by ClaimModal (options shown) and relay.js (validation), keyed by claim kind.
const DEFAULT_RATIONALES = ['Not on screen', 'Not clear enough', 'Need more context'];

const RATIONALES_BY_KIND = {
  mark: DEFAULT_RATIONALES,
  unmark: DEFAULT_RATIONALES,
  replace: ['It could still happen', 'It fits this movie', 'I wagered on it'],
};

export function getDisagreeRationales(kind) {
  return RATIONALES_BY_KIND[kind] || DEFAULT_RATIONALES;
}

export function isValidDisagreeRationale(kind, rationale) {
  return getDisagreeRationales(kind).includes(rationale);
}
