// Canonical cross-genre tropes. A shared trope owns its label, explanation,
// example, and every genre/subgenre membership in one declaration.
function sharedTrope(text, what, example, memberships, optional = false) {
  return { text, what, example, memberships, optional };
}

export const SHARED_TROPES = [
  sharedTrope(
    'Product placement',
    'A recognizable real-world brand is prominently shown or explicitly named. Incidental background logos do not count. Players need not establish whether the appearance was paid or sponsored.',
    'A close-up makes a soda-can label clearly readable while a character drinks.',
    [
      ['comedy', ['general']],
      ['action', ['general']],
      ['thriller', ['general']],
      ['romance', ['general']],
      ['drama', ['general']],
      ['tv', ['reality-tv', 'lifestyle']],
    ],
    true,
  ),
  sharedTrope(
    'A fictional business is named',
    'An invented company, restaurant, shop, or commercial brand is named or shown on a sign. A real business using a fictional branch does not count.',
    'Characters order lunch at Big Kahuna Burger.',
    [
      ['comedy', ['general', 'workplace']],
      ['action', ['general']],
      ['sci-fi', ['general', 'dystopian']],
      ['fantasy', ['general']],
      ['thriller', ['general']],
      ['animation', ['general']],
    ],
  ),
  sharedTrope(
    'A montage',
    'A sequence of short shots compresses an extended activity or passage of time. Ordinary cuts within one continuous scene do not count.',
    'Several shots show a character training over successive days.',
    [
      ['comedy', ['general']],
      ['action', ['general', 'martial-arts']],
      ['romance', ['general']],
      ['drama', ['general']],
      ['biography', ['general', 'sports-biopic']],
      ['music', ['general']],
      ['sport', ['general', 'underdog-story']],
    ],
  ),
  sharedTrope(
    'Bullying',
    'Someone uses a power advantage to intimidate, humiliate, or exclude another person. Mutual arguments and clearly welcome teasing do not count.',
    "A group blocks a student's path and mocks them while others watch.",
    [
      ['drama', ['general', 'family-drama']],
      ['family', ['general']],
      ['comedy', ['general', 'workplace']],
      ['sport', ['general', 'sports-drama', 'underdog-story']],
    ],
  ),
  sharedTrope(
    'A slur is used',
    'Spoken or written language clearly demeans someone because of their identity or group membership. General profanity does not count, and no player needs to repeat the wording.',
    'A character directs a discriminatory insult at another character.',
    [
      ['drama', ['general']],
      ['thriller', ['general', 'noir-crime']],
      ['biography', ['general']],
      ['history', ['general', 'historical-drama']],
      ['war', ['general', 'war-drama']],
      ['documentary', ['true-crime']],
    ],
    true,
  ),
  sharedTrope(
    'An old verse is quoted',
    'Someone quotes a recognizable passage from scripture, an older poem, or traditional verse. A newly invented prediction is not automatically a quotation.',
    'A character recites a line from an old poem while explaining a decision.',
    [
      ['drama', ['general']],
      ['fantasy', ['general', 'epic-fantasy']],
      ['history', ['general']],
      ['biography', ['general']],
      ['horror', ['supernatural', 'psychological']],
      ['romance', ['period-romance']],
    ],
  ),
  sharedTrope(
    'An ominous warning',
    'A person warns the characters of serious danger ahead. The warning need not be believed, and an unexplained visual omen alone does not count.',
    'A resident urges visitors to leave before nightfall but refuses to explain why.',
    [
      ['horror', ['general', 'supernatural', 'creature']],
      ['thriller', ['general']],
      ['adventure', ['general']],
      ['fantasy', ['epic-fantasy']],
    ],
  ),
  sharedTrope(
    'Alcohol, tobacco, or drugs are used',
    'Someone visibly drinks alcohol, smokes or vapes tobacco, or uses an intoxicating drug. Merely holding a container, discussing drugs, or taking ordinary prescribed medicine does not count. This does not imply illegality, dependence, or impairment.',
    'A character pours whiskey and takes a sip.',
    [
      ['drama', ['general']],
      ['comedy', ['general']],
      ['thriller', ['general', 'noir-crime']],
      ['romance', ['general']],
      ['biography', ['general', 'music-biopic']],
      ['western', ['general']],
      ['music', ['music-industry']],
    ],
    true,
  ),
  sharedTrope(
    'A scene in a burial ground',
    'Meaningful scene action takes place in a cemetery, graveyard, crypt, or burial ground. A passing shot of a gravestone does not count.',
    'Two characters discuss a secret beside a family grave.',
    [
      ['horror', ['general', 'supernatural']],
      ['drama', ['general']],
      ['thriller', ['general']],
      ['history', ['general']],
      ['western', ['general']],
      ['fantasy', ['epic-fantasy']],
      ['romance', ['romantic-drama']],
    ],
  ),
  sharedTrope(
    'A relationship switches sides',
    'Characters established as friends or allies become openly opposed, or established opponents willingly cooperate toward a shared goal. Temporary arguments and being forced into the same situation do not count; the change must be demonstrated through words or actions.',
    'Former friends choose opposing sides and refuse to help each other, or two enemies agree to share information and work together against a common threat.',
    [
      ['action', ['general']],
      ['adventure', ['general']],
      ['drama', ['general']],
      ['fantasy', ['general']],
      ['thriller', ['general']],
      ['comedy', ['buddy-comedy']],
      ['sci-fi', ['space-opera']],
      ['war', ['combat', 'war-drama']],
    ],
  ),
  sharedTrope(
    'Unconvincing visual effects',
    'An effect visibly fails to fit the surrounding scene through mismatched lighting, motion, or contact. Intentional cartoon styling does not count, and players need not identify whether CGI was used.',
    'A creature seems to float above the floor and has lighting inconsistent with the room.',
    [
      ['sci-fi', ['general']],
      ['fantasy', ['general']],
      ['horror', ['creature']],
      ['action', ['disaster']],
    ],
    true,
  ),
  sharedTrope(
    '"How did they film that?"',
    'A striking shot or sequence makes viewers wonder how it was executed rather than what happens in the story. This is a subjective group judgment, not a claim about the technique used.',
    'A seamless-looking shot follows someone through several difficult-to-access spaces.',
    [
      ['action', ['general']],
      ['adventure', ['general']],
      ['sci-fi', ['general']],
      ['fantasy', ['general']],
    ],
    true,
  ),
  sharedTrope(
    'Killer appears impossibly far ahead',
    'A pursuing killer reaches a new position without a plausible route or enough apparent time. Explained teleportation and clear time jumps do not count.',
    'A fleeing character reaches a destination, but the killer who was behind them is already waiting.',
    [
      ['horror', ['slasher']],
      ['comedy', ['spoof-parody']],
    ],
  ),
  sharedTrope(
    'A swerve causes a crash',
    'A driver swerves to avoid an obstacle and crashes as a result.',
    'A driver avoids an animal but hits a roadside barrier.',
    [
      ['action', ['general', 'disaster']],
      ['thriller', ['general']],
      ['horror', ['general']],
    ],
  ),
  sharedTrope(
    'Misses an obvious hint',
    'A character fails to understand a plainly communicated social cue. Being unaware of a nearby threat belongs to Danger just out of sight instead.',
    'Everyone signals someone to stop talking, but they continue revealing a secret.',
    [
      ['comedy', ['general', 'rom-com', 'workplace']],
      ['romance', ['general']],
    ],
  ),
  sharedTrope(
    'An everyday object becomes deadly',
    'A death involves an object not ordinarily presented as a weapon. Conventional weapons do not count; unlike Earlier object becomes a weapon, no earlier setup is required.',
    'An ordinary room prop unexpectedly becomes the cause of an on-screen death.',
    [
      ['horror', ['slasher']],
      ['thriller', ['noir-crime']],
      ['action', ['general']],
    ],
  ),
  sharedTrope(
    'A continuity error',
    'A prop, costume, or position changes inconsistently between cuts within the same continuous scene. Time jumps, dreams, and intentional distortions do not count.',
    'A half-empty glass becomes full in the reverse angle without anyone refilling it.',
    [
      ['horror', ['general']],
      ['comedy', ['general']],
      ['action', ['general']],
      ['sci-fi', ['general']],
      ['fantasy', ['general']],
      ['thriller', ['general']],
      ['romance', ['general']],
      ['drama', ['general']],
    ],
    true,
  ),
  sharedTrope(
    "Something doesn't fit the period",
    'An object or detail contradicts the established historical period. Explained time travel and deliberately mixed settings do not count; unlike An anachronistic joke, this need not be an intentional joke.',
    'A digital wristwatch appears in a scene explicitly set in ancient Rome.',
    [
      ['history', ['general']],
      ['biography', ['general']],
      ['romance', ['period-romance']],
      ['western', ['general']],
    ],
    true,
  ),
  sharedTrope(
    'An implausible explosion',
    'An explosion seems disproportionate or unsupported by what the scene establishes. An evident or explained cause, such as fuel or pressure, rules it out; this is a subjective group judgment.',
    'A minor collision produces a huge fireball with no evident justification.',
    [
      ['action', ['general', 'disaster']],
      ['comedy', ['spoof-parody']],
    ],
    true,
  ),
  sharedTrope(
    'Celebrates too soon',
    'Someone celebrates an apparent success before the problem is resolved, and the celebration is then undercut.',
    'The group cheers that a plan worked just before an alarm sounds.',
    [
      ['comedy', ['general']],
      ['action', ['general']],
      ['horror', ['general']],
      ['thriller', ['general']],
      ['sport', ['general']],
    ],
  ),
  sharedTrope(
    '"This isn\'t funny, guys."',
    'A character mistakes a real threat or troubling event for a prank. The exact line is not required, but an actual prank does not count.',
    'Someone calls out to their friends about a joke, but no friend is responsible.',
    [
      ['horror', ['general', 'slasher']],
      ['thriller', ['general']],
    ],
  ),
  sharedTrope(
    'Heavy-handed foreshadowing',
    'Repeated warnings or conspicuous emphasis strongly telegraph a later event. Count it once the payoff confirms the setup; how heavy-handed it feels is a subjective group judgment.',
    'A dangerous railing is repeatedly emphasized before it gives way.',
    [
      ['horror', ['general']],
      ['thriller', ['general']],
      ['action', ['general']],
      ['adventure', ['general']],
    ],
    true,
  ),
  sharedTrope(
    'Destroyed object returns intact',
    'An object clearly destroyed earlier returns whole at story level, through restoration, magic, or an unexplained return. A prop resetting between cuts is a continuity error, not this trope.',
    'A shattered magical relic later appears whole again.',
    [
      ['fantasy', ['general']],
      ['horror', ['supernatural']],
      ['sci-fi', ['general']],
    ],
  ),
  sharedTrope(
    'Unwanted attention persists',
    'A character continues unwanted flirting or personal attention after a clear refusal or boundary. Appearance alone or a single friendly approach does not count.',
    'A stranger keeps approaching someone after being told to leave them alone.',
    [
      ['thriller', ['general']],
      ['horror', ['psychological']],
      ['drama', ['general']],
      ['romance', ['romantic-drama']],
    ],
  ),
  sharedTrope(
    'An ominous phone ring',
    'The film frames a ringing phone as threatening through timing, sound, or a visible reaction. An ordinary incoming call does not count; a scary phone call concerns what is heard after answering.',
    'During a suspenseful silence, someone hesitates while staring at the ringing phone.',
    [
      ['horror', ['general']],
      ['thriller', ['general']],
    ],
  ),
  sharedTrope(
    'A woman is called a bitch',
    'That specific insult is directed at, or explicitly used about, a female character. Other insults or hostile tone do not count. This is an optional language-sensitive dialogue trope.',
    'During an argument, someone uses the exact word about a woman.',
    [
      ['drama', ['general']],
      ['thriller', ['noir-crime']],
      ['horror', ['slasher']],
    ],
    true,
  ),
  sharedTrope(
    'Police dismiss a disappearance',
    'Police refuse or postpone investigating a missing-person report, dismissing the concern or imposing a waiting period within the story. This describes the story, not a real-world reporting requirement.',
    'An officer says the missing person probably left voluntarily and tells the family to return later.',
    [
      ['thriller', ['general', 'mystery-whodunit', 'noir-crime']],
      ['horror', ['general']],
      ['drama', ['family-drama']],
      ['documentary', ['true-crime']],
    ],
  ),
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

export const SHARED_TROPE_ROWS = SHARED_TROPES.flatMap(({ text, memberships, optional }) =>
  memberships.map(([genre, subgenres]) => ({ text, genre, subgenres, optional })),
);

export const SHARED_TROPE_DESCRIPTIONS = Object.fromEntries(
  SHARED_TROPES.map(({ text, what, example }) => [text, { what, example }]),
);
