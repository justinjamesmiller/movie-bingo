// Pool of horror-movie tropes used to build bingo boards, tagged by sub-genre.
// Every trope tagged "general" is always eligible regardless of which
// sub-genre the host picks; sub-genre-specific tropes are only added on top
// of the general pool when that sub-genre is selected.
export const SUBGENRES = [
  { id: 'general', label: 'Classic / Mixed Horror' },
  { id: 'slasher', label: 'Slasher' },
  { id: 'supernatural', label: 'Supernatural / Haunted House' },
  { id: 'zombie', label: 'Zombie / Outbreak' },
  { id: 'found-footage', label: 'Found Footage' },
  { id: 'psychological', label: 'Psychological' },
  { id: 'creature', label: 'Creature Feature / Monster' },
];

const DEFAULT_SUBGENRE = 'general';

export const TROPES = [
  // ---------- General (eligible in every sub-genre) ----------
  { text: 'Jump Scare', genres: ['general'] },
  { text: '"I\'ll be right back."', genres: ['general'] },
  { text: 'Power goes out', genres: ['general'] },
  { text: 'Phone has no signal', genres: ['general'] },
  { text: "Car won't start", genres: ['general'] },
  { text: 'Investigates a strange noise', genres: ['general'] },
  { text: 'A warning is ignored', genres: ['general'] },
  { text: 'Dog barks at nothing', genres: ['general'] },
  { text: 'Creepy basement', genres: ['general'] },
  { text: 'The group splits up', genres: ['general'] },
  { text: 'Lights flicker or go out', genres: ['general'] },
  { text: 'Someone trips while running', genres: ['general', 'slasher'] },
  { text: 'Breaking the one rule', genres: ['general'] },
  { text: 'A thunderstorm', genres: ['general'] },
  { text: 'Babysitter left alone', genres: ['general'] },
  { text: 'No one believes the victim', genres: ['general'] },
  { text: 'Hiding in a closet', genres: ['general', 'slasher'] },
  { text: 'Cat causes a fake scare', genres: ['general'] },
  { text: 'A locked door fails', genres: ['general'] },
  { text: 'A family secret', genres: ['general', 'supernatural'] },
  { text: 'An abandoned building', genres: ['general', 'psychological'] },
  { text: 'An omen is ignored', genres: ['general'] },
  { text: 'Odd security footage', genres: ['general', 'found-footage'] },
  { text: 'The car breaks down', genres: ['general'] },
  { text: 'Letting a stranger in', genres: ['general'] },
  { text: 'Odd townspeople', genres: ['general'] },
  { text: 'A scream lures them in', genres: ['general'] },
  { text: 'Teamwork saves the day', genres: ['general'] },
  { text: 'A "safe" scene isn\'t', genres: ['general'] },
  { text: '"Hello?" into the dark', genres: ['general'] },
  { text: 'A door closes itself', genres: ['general'] },
  { text: 'Blood splatter', genres: ['general'] },
  { text: 'Gratuitous shower scene', genres: ['general'] },
  { text: 'Terrible decision-making', genres: ['general'] },
  { text: 'A body falls suddenly', genres: ['general'] },
  { text: 'Creepy attic', genres: ['general'] },
  { text: 'Flashlight stops working', genres: ['general'] },
  { text: 'Conveniently unlocked door', genres: ['general'] },
  { text: 'Backs into danger', genres: ['general'] },
  { text: '"It\'s probably nothing"', genres: ['general'] },
  { text: 'Dragged off-screen', genres: ['general'] },
  { text: 'Gratuitous nudity or sex', genres: ['general'] },
  { text: 'Drenched in blood', genres: ['general'] },
  { text: 'Police arrive too late', genres: ['general'] },

  // ---------- Slasher ----------
  { text: 'Final girl moment', genres: ['slasher'] },
  { text: 'Killer presumed dead', genres: ['slasher'] },
  { text: 'A call from inside', genres: ['slasher'] },
  { text: 'A close-up of a weapon', genres: ['slasher'] },
  { text: 'Killer wears a mask', genres: ['slasher'] },
  { text: 'A threatening text', genres: ['slasher'] },
  { text: 'Killer was a friend', genres: ['slasher'] },
  { text: 'A scary phone call', genres: ['slasher'] },
  { text: 'Killer in the back seat', genres: ['slasher'] },
  { text: 'A villain monologue', genres: ['slasher'] },
  { text: 'Picked off one by one', genres: ['slasher'] },
  { text: 'Final fight, back home', genres: ['slasher'] },
  { text: 'An unlikely suspect', genres: ['slasher'] },
  { text: 'A familiar weapon', genres: ['slasher'] },
  { text: 'Weapon dropped at worst time', genres: ['slasher'] },
  { text: 'Killer appears behind someone', genres: ['slasher'] },
  { text: 'Killer walks, victim runs', genres: ['slasher'] },

  // ---------- Supernatural / Haunted House ----------
  { text: 'Mirror jump scare', genres: ['supernatural'] },
  { text: 'Creepy child', genres: ['supernatural'] },
  { text: 'A cursed artifact', genres: ['supernatural'] },
  { text: 'A clue in a photo', genres: ['supernatural'] },
  { text: 'A religious symbol fails', genres: ['supernatural'] },
  { text: 'Rituals or cultlike behavior', genres: ['supernatural'] },
  { text: 'Ghost seen in reflection', genres: ['supernatural'] },
  { text: 'Creepy doll', genres: ['supernatural'] },
  { text: 'A cemetery', genres: ['supernatural'] },
  { text: 'A moving shadow', genres: ['supernatural'] },
  { text: 'Whispering voices', genres: ['supernatural', 'psychological'] },
  { text: 'A clock stops nightly', genres: ['supernatural'] },
  { text: 'An urban legend is real', genres: ['supernatural'] },
  { text: 'A mysterious background figure', genres: ['supernatural', 'psychological'] },
  { text: 'A dangerous deal made', genres: ['supernatural'] },
  { text: 'A witch, wizard, or sorcerer', genres: ['supernatural'] },
  { text: 'An object must be returned', genres: ['supernatural'] },
  { text: 'A haunted house', genres: ['supernatural'] },
  { text: 'Possessed person', genres: ['supernatural'] },
  { text: 'Ouija board or séance', genres: ['supernatural'] },
  { text: 'Reads a cursed book', genres: ['supernatural'] },
  { text: 'Creepy music box', genres: ['supernatural'] },

  // ---------- Zombie / Outbreak ----------
  { text: 'A hidden bite', genres: ['zombie'] },
  { text: 'Barricading the doors', genres: ['zombie'] },
  { text: 'Bitten saving someone else', genres: ['zombie'] },
  { text: 'Arguing to trust a stranger', genres: ['zombie'] },
  { text: 'The military makes it worse', genres: ['zombie'] },
  { text: 'A false safe-zone broadcast', genres: ['zombie'] },
  { text: '"They\'re not really gone"', genres: ['zombie'] },
  { text: 'A noise draws the horde', genres: ['zombie'] },
  { text: 'Out of ammo', genres: ['zombie'] },
  { text: 'A transformative virus', genres: ['zombie'] },
  { text: 'A supply run gone wrong', genres: ['zombie'] },
  { text: 'Losing the getaway vehicle', genres: ['zombie'] },

  // ---------- Found Footage ----------
  { text: 'Camera shakes violently', genres: ['found-footage'] },
  { text: 'Static right before a scare', genres: ['found-footage'] },
  { text: 'A character live-streams this', genres: ['found-footage'] },
  { text: '"Why are you still filming?"', genres: ['found-footage'] },
  { text: 'Battery dies at worst time', genres: ['found-footage'] },
  { text: 'Night-vision reveals something', genres: ['found-footage'] },
  { text: '"Recovered" footage', genres: ['found-footage'] },
  { text: 'Narrating straight to camera', genres: ['found-footage'] },
  { text: 'Camera dropped, still recording', genres: ['found-footage'] },
  { text: 'GPS stops working', genres: ['found-footage'] },
  { text: 'A goodbye to the camera', genres: ['found-footage'] },

  // ---------- Psychological ----------
  { text: 'Waking from a nightmare', genres: ['psychological'] },
  { text: 'Questioning their own sanity', genres: ['psychological'] },
  { text: 'A twist ending', genres: ['psychological'] },
  { text: 'No one else sees it', genres: ['psychological'] },
  { text: 'Time loops or repeats', genres: ['psychological'] },
  { text: 'Suspicious medication', genres: ['psychological'] },
  { text: 'Grief given monstrous form', genres: ['psychological'] },
  { text: 'The know-it-all dies', genres: ['psychological'] },
  { text: 'Memory and reality blur', genres: ['psychological'] },
  { text: 'A forgotten, horrific act', genres: ['psychological'] },
  { text: 'The house rearranges itself', genres: ['psychological'] },
  { text: 'Gaslit by a loved one', genres: ['psychological'] },
  { text: 'An earlier scene wasn\'t safe', genres: ['psychological'] },

  // ---------- Creature Feature / Monster ----------
  { text: 'Glimpsed only in shadow', genres: ['creature'] },
  { text: 'A local\'s dire warning', genres: ['creature'] },
  { text: 'Smarter than expected', genres: ['creature'] },
  { text: 'Snatched just out of reach', genres: ['creature'] },
  { text: 'A failed lab experiment', genres: ['creature'] },
  { text: 'Remains of a past victim', genres: ['creature'] },
  { text: 'A trap backfires', genres: ['creature'] },
  { text: 'There\'s more than one', genres: ['creature'] },
  { text: 'Weapons barely slow it', genres: ['creature'] },
  { text: 'Tries to spare the creature', genres: ['creature'] },
  { text: 'Mimics a human voice', genres: ['creature'] },
  { text: 'A flare reveals it', genres: ['creature'] },
];

export const CENTER_INDEX = 12; // middle of a 5x5 grid (0-indexed)
export const FREE_SPACE_TEXT = 'FREE SPACE';

// Host-configurable slider steps for how much of the board is drawn from the
// general pool vs. the chosen sub-genre's specific pool.
export const GENERAL_PERCENT_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
export const DEFAULT_GENERAL_PERCENT = 50;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks `total` trope texts for a board, aiming for `generalPercent`% from the
// general pool (general tropes are the shared baseline; sub-genre-specific
// tropes fill the rest). Falls back to topping up from the general pool if
// the specific pool is too small to hit the requested mix -- a board always
// has exactly `total` unique tropes even if the exact percentage can't be met.
function pickBoardTropes(subgenre, total, generalPercent) {
  const desiredGeneral = Math.round((total * generalPercent) / 100);
  const generalPool = shuffle(TROPES.filter((t) => t.genres.includes('general')).map((t) => t.text));
  const specificPool = subgenre === DEFAULT_SUBGENRE
    ? []
    : shuffle(TROPES.filter((t) => !t.genres.includes('general') && t.genres.includes(subgenre)).map((t) => t.text));

  let generalCount = Math.min(desiredGeneral, generalPool.length, total);
  const specificCount = Math.min(total - generalCount, specificPool.length);

  let chosen = [...generalPool.slice(0, generalCount), ...specificPool.slice(0, specificCount)];
  if (chosen.length < total) {
    chosen = chosen.concat(generalPool.slice(generalCount, generalCount + (total - chosen.length)));
  }
  return shuffle(chosen).slice(0, total);
}

export function generateBoard(subgenre = DEFAULT_SUBGENRE, useFreeSpace = false, generalPercent = DEFAULT_GENERAL_PERCENT) {
  if (!useFreeSpace) return pickBoardTropes(subgenre, 25, generalPercent);

  const chosen = pickBoardTropes(subgenre, 24, generalPercent);
  const board = new Array(25);
  let idx = 0;
  for (let i = 0; i < 25; i++) {
    board[i] = i === CENTER_INDEX ? FREE_SPACE_TEXT : chosen[idx++];
  }
  return board;
}
