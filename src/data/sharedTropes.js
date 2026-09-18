// Canonical cross-genre tropes. A shared trope owns its label, explanation,
// example, and every genre/subgenre membership in one declaration.
function sharedTrope(text, what, example, memberships) {
  return { text, what, example, memberships };
}

export const SHARED_TROPES = [
  sharedTrope(
    'A scene plays in slow motion',
    'An otherwise ordinary moment is deliberately shown at reduced speed for emphasis.',
    'A character turns toward the camera as everything around them slows down.',
    [
      ['action', ['general']],
      ['drama', ['general']],
      ['thriller', ['general']],
    ],
  ),
  sharedTrope(
    'A villain saves a cat',
    'An antagonistic character does something kind to make them seem more sympathetic or complicated.',
    'The villain pauses a getaway to rescue a cat from the street.',
    [
      ['action', ['general']],
      ['thriller', ['general']],
      ['drama', ['general']],
    ],
  ),
  sharedTrope(
    'It was just a dream',
    'A frightening or dramatic sequence is revealed to have happened only in a dream.',
    'The character wakes up just after the monster reaches them.',
    [
      ['horror', ['psychological']],
      ['thriller', ['mystery-whodunit']],
      ['drama', ['general']],
    ],
  ),
  sharedTrope(
    'A dead or dying animal',
    'An animal is shown injured, dying, or dead to signal danger, loss, or environmental harm.',
    'The characters find a bird lying still beside the trail.',
    [
      ['horror', ['general']],
      ['documentary', ['nature']],
      ['drama', ['general']],
    ],
  ),
  sharedTrope(
    'A twig snaps',
    'A small breaking sound reveals that someone or something may be nearby.',
    'The group goes quiet after a sharp crack comes from the woods.',
    [['horror', ['general']]],
  ),
  sharedTrope(
    'An inappropriately cheerful reaction',
    'Someone responds to serious or upsetting news with an oddly upbeat attitude.',
    'They grin and clap while everyone else is stunned into silence.',
    [
      ['comedy', ['general']],
      ['horror', ['general']],
    ],
  ),
  sharedTrope(
    'No sense of urgency',
    'Characters treat an obviously time-sensitive danger as though there is plenty of time.',
    'They stop to argue while the alarm keeps counting down.',
    [
      ['action', ['general']],
      ['horror', ['general']],
      ['thriller', ['general']],
    ],
  ),
  sharedTrope(
    'A character is too trusting',
    'Someone accepts a suspicious story or stranger with very little hesitation.',
    'They hand over the keys after hearing only a first name.',
    [
      ['comedy', ['general']],
      ['horror', ['general']],
      ['romance', ['general']],
    ],
  ),
  sharedTrope(
    'Danger just out of sight',
    'The audience can see a threat nearby while the characters remain unaware of it.',
    'A shadow crosses the doorway behind someone facing the other way.',
    [
      ['horror', ['general']],
      ['thriller', ['general']],
    ],
  ),
  sharedTrope(
    'The victim is too loud',
    'A threatened character makes enough noise to draw more danger instead of escaping quietly.',
    'They shout for help while hiding inches from the killer.',
    [['horror', ['slasher']]],
  ),
  sharedTrope(
    'Someone returns after being presumed dead',
    'A character believed dead or permanently gone unexpectedly comes back.',
    'The missing friend walks into the room just after the memorial.',
    [
      ['action', ['general']],
      ['horror', ['general']],
      ['thriller', ['general']],
    ],
  ),
  sharedTrope(
    'A telling gravestone',
    'A grave marker reveals a clue about a character, a death, or the history of a place.',
    'One name on the weathered stone matches the name in the old diary.',
    [['horror', ['general']]],
  ),
  sharedTrope(
    'Music clashes with the scene',
    'The soundtrack deliberately conflicts with the mood or action on screen.',
    'A cheerful pop song plays over a tense chase.',
    [
      ['comedy', ['general']],
      ['horror', ['general']],
    ],
  ),
  sharedTrope(
    'A signature music cue',
    'A recurring piece of music announces a character, place, or kind of moment.',
    'The same ominous notes begin whenever the villain appears.',
    [
      ['action', ['general']],
      ['fantasy', ['general']],
      ['horror', ['general']],
    ],
  ),
  sharedTrope(
    'A signature sound effect',
    'A distinctive repeated sound announces a character, object, or event.',
    'The hero arrives with the same roaring engine sound every time.',
    [
      ['action', ['general']],
      ['sci-fi', ['general']],
    ],
  ),
  sharedTrope(
    'Baffling priorities',
    'A character focuses on something trivial while a much more important problem is unfolding.',
    'They insist on finding a jacket while everyone else is escaping the fire.',
    [
      ['action', ['general']],
      ['comedy', ['general']],
      ['horror', ['general']],
    ],
  ),
  sharedTrope(
    'A surprisingly smart decision',
    'A character makes a sensible choice that avoids the obvious genre mistake.',
    'They call for backup instead of entering the dark building alone.',
    [
      ['action', ['general']],
      ['horror', ['general']],
      ['thriller', ['general']],
    ],
  ),
  sharedTrope(
    'No goodbye before hanging up',
    'A phone conversation ends abruptly without either person saying goodbye.',
    'The call ends the instant the information is delivered.',
    [
      ['comedy', ['general']],
      ['drama', ['general']],
      ['romance', ['general']],
    ],
  ),
  sharedTrope(
    'The villain was someone trusted',
    'A trusted friend, ally, or authority figure is revealed to be the antagonist.',
    'The helpful mentor is the one who arranged the whole plot.',
    [
      ['action', ['spy-espionage']],
      ['horror', ['slasher']],
      ['thriller', ['mystery-whodunit']],
    ],
  ),
  sharedTrope(
    'A manic pixie dream girl',
    "A quirky, free-spirited woman is framed mainly as a catalyst for another character's self-discovery.",
    'Her spontaneous plans exist chiefly to pull the withdrawn hero out of his routine.',
    [
      ['comedy', ['rom-com']],
      ['romance', ['general']],
    ],
  ),
  sharedTrope(
    'Killed by fire',
    'A character or threat is defeated or dies through flames or burning.',
    'The creature is finally stopped when the building catches fire.',
    [
      ['action', ['general']],
      ['fantasy', ['epic-fantasy']],
      ['horror', ['slasher']],
    ],
  ),
  sharedTrope(
    'A cheesy title card',
    'An overly stylized or melodramatic title card appears on screen.',
    'The movie title slams onto the screen with lightning and a guitar chord.',
    [
      ['comedy', ['spoof-parody']],
      ['horror', ['general']],
    ],
  ),
  sharedTrope(
    'Vomiting reveals pregnancy',
    "A character's nausea is treated as the first obvious clue that they are pregnant.",
    'After rushing from breakfast, they pause and realize what the sickness means.',
    [
      ['comedy', ['rom-com']],
      ['drama', ['family-drama']],
      ['romance', ['romantic-drama']],
    ],
  ),
];

export const SHARED_TROPE_ROWS = SHARED_TROPES.flatMap(({ text, memberships }) =>
  memberships.map(([genre, subgenres]) => ({ text, genre, subgenres })),
);

export const SHARED_TROPE_DESCRIPTIONS = Object.fromEntries(
  SHARED_TROPES.map(({ text, what, example }) => [text, { what, example }]),
);
