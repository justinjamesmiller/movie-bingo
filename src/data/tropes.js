// Pool of horror-movie tropes used to build bingo boards.
export const TROPES = [
  'Jump Scare',
  'The "Final Girl" is the last one standing',
  "Character says \"I'll be right back\" and dies",
  'Power goes out at the worst possible moment',
  'Cell phone has no signal',
  "Car won't start during the chase",
  'Someone investigates a strange noise alone',
  "The killer is presumed dead but isn't",
  'A mirror reveals something standing behind a character',
  "A stranger's warning is completely ignored",
  'Found-footage camera shakes violently',
  'A creepy child says something unsettling',
  'The dog barks at nothing... or something',
  'A character reads aloud from a cursed book or tape',
  'Basement or attic explored despite obvious danger',
  'The group splits up to search the house',
  'The lights flicker right before something happens',
  'A character trips and falls while running away',
  'Static or distortion appears right before a scare',
  '"The call is coming from inside the house"',
  "An old photograph shows something that wasn't there before",
  'Someone breaks the one rule they were told never to break',
  'A thunderstorm perfectly times the mood',
  'The babysitter is left alone with the kids',
  "Nobody believes the survivor's warning",
  'A religious symbol fails to stop the evil',
  'A séance or ritual goes horribly wrong',
  "The killer wears a mask hiding their true identity",
  'A character hides in a closet while being hunted',
  'Fake-out jump scare caused by a cat',
  'A locked door fails to keep the evil out',
  'A character spots the ghost in a reflection first',
  'A threatening text message from the killer',
  'An old family secret is uncovered',
  'A creepy doll or toy moves on its own',
  'The house was built on a cursed burial ground',
  'A character explores an abandoned asylum or hospital',
  'The killer turns out to be someone the group trusted',
  'A warning label or omen is read and then ignored',
  "A character's shadow moves on its own",
  "Security footage catches something that shouldn't be possible",
  'A phone call warns "get out of the house"',
  'The car breaks down in the middle of nowhere',
  'Someone lets a suspicious stranger inside',
  "The killer is hiding in the back seat of the car",
  'A character hears their own name whispered',
  'A clock stops at the same time every night',
  'A character wakes from a nightmare... or did they?',
  'An obvious warning sign is ignored by the whole group',
  'A scream draws characters toward danger instead of away',
  'The power of teamwork saves the day at the last second',
  'A character live-streams their own demise',
  'The "safe" daylight scene turns out not to be so safe',
  'An urban legend turns out to be true',
  'A character sees a figure standing perfectly still in the distance',
  "The killer's motive is revealed in a monologue",
  "A character makes a deal with something they shouldn't have",
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateBoard() {
  return shuffle(TROPES).slice(0, 25);
}
