// Additional broad movie/TV genre coverage, kept separate from the hand-curated
// original pools so the main tropes.js file stays readable. Each genre and each
// listed sub-genre receives the same 40 reusable scene beats with a genre-specific
// prefix, which guarantees every new pool is large enough for board generation
// and every generated trope has a matching explanation/example.
export const EXPANDED_GENRES = [
  { id: 'adventure', label: 'Adventure' },
  { id: 'animation', label: 'Animation' },
  { id: 'biography', label: 'Biography' },
  { id: 'family', label: 'Family' },
  { id: 'history', label: 'History' },
  { id: 'music', label: 'Music' },
  { id: 'musical', label: 'Musical' },
  { id: 'sport', label: 'Sport' },
  { id: 'war', label: 'War' },
  { id: 'western', label: 'Western' },
  { id: 'tv', label: 'TV / Unscripted' },
];

export const EXPANDED_SUBGENRES_BY_GENRE = {
  adventure: [
    { id: 'general', label: 'Classic / Mixed Adventure' },
    { id: 'pirate', label: 'Pirate' },
    { id: 'treasure-hunt', label: 'Treasure Hunt' },
    { id: 'survival', label: 'Survival' },
    { id: 'adventure-epic', label: 'Adventure Epic' },
  ],
  animation: [
    { id: 'general', label: 'Classic / Mixed Animation' },
    { id: 'computer-animation', label: 'Computer Animation' },
    { id: 'stop-motion', label: 'Stop-Motion' },
    { id: 'anime', label: 'Anime' },
    { id: 'adult-animation', label: 'Adult Animation' },
  ],
  biography: [
    { id: 'general', label: 'Classic / Mixed Biography' },
    { id: 'music-biopic', label: 'Music Biopic' },
    { id: 'sports-biopic', label: 'Sports Biopic' },
    { id: 'political-biopic', label: 'Political Biopic' },
    { id: 'artist-biopic', label: 'Artist Biopic' },
  ],
  family: [
    { id: 'general', label: 'Classic / Mixed Family' },
    { id: 'family-comedy', label: 'Family Comedy' },
    { id: 'family-adventure', label: 'Family Adventure' },
    { id: 'children-fantasy', label: "Children's Fantasy" },
    { id: 'family-animation', label: 'Family Animation' },
  ],
  history: [
    { id: 'general', label: 'Classic / Mixed History' },
    { id: 'historical-drama', label: 'Historical Drama' },
    { id: 'historical-epic', label: 'Historical Epic' },
    { id: 'historical-romance', label: 'Historical Romance' },
    { id: 'historical-adventure', label: 'Historical Adventure' },
  ],
  music: [
    { id: 'general', label: 'Classic / Mixed Music' },
    { id: 'music-documentary', label: 'Music Documentary' },
    { id: 'concert-film', label: 'Concert Film' },
    { id: 'music-biopic', label: 'Music Career Biopic' },
    { id: 'music-industry', label: 'Music Industry' },
  ],
  musical: [
    { id: 'general', label: 'Classic / Mixed Musical' },
    { id: 'musical-comedy', label: 'Musical Comedy' },
    { id: 'musical-drama', label: 'Musical Drama' },
    { id: 'animated-musical', label: 'Animated Musical' },
    { id: 'jukebox-musical', label: 'Jukebox Musical' },
  ],
  sport: [
    { id: 'general', label: 'Classic / Mixed Sport' },
    { id: 'sports-drama', label: 'Sports Drama' },
    { id: 'sports-comedy', label: 'Sports Comedy' },
    { id: 'underdog-story', label: 'Underdog Story' },
    { id: 'racing', label: 'Racing' },
  ],
  war: [
    { id: 'general', label: 'Classic / Mixed War' },
    { id: 'combat', label: 'Combat Film' },
    { id: 'anti-war', label: 'Anti-War' },
    { id: 'war-drama', label: 'War Drama' },
    { id: 'prisoner-of-war', label: 'Prisoner-of-War' },
  ],
  western: [
    { id: 'general', label: 'Classic / Mixed Western' },
    { id: 'classic-western', label: 'Classic Western' },
    { id: 'revisionist-western', label: 'Revisionist Western' },
    { id: 'modern-western', label: 'Modern Western' },
    { id: 'space-western', label: 'Space Western' },
  ],
  tv: [
    { id: 'general', label: 'Classic / Mixed TV' },
    { id: 'reality-tv', label: 'Reality TV' },
    { id: 'game-show', label: 'Game Show' },
    { id: 'talk-show', label: 'Talk Show' },
    { id: 'news-magazine', label: 'News Magazine' },
  ],
};

const BEATS = [
  {
    text: 'opening hook',
    what: 'the story quickly shows the promise of this kind of title',
    example: 'The first scene establishes the core appeal before the main plot settles in',
  },
  {
    text: 'mentor warning',
    what: 'an experienced figure warns the lead about what this world demands',
    example: 'A veteran explains the risk and the newcomer ignores only half of it',
  },
  {
    text: 'impossible deadline',
    what: 'the characters have too little time to do something important',
    example: 'A clock, event, or public commitment forces everyone to act immediately',
  },
  {
    text: 'secret map',
    what: 'a diagram, clue, plan, or route changes what the characters know',
    example: 'Someone unfolds a marked-up page and realizes where they have to go next',
  },
  {
    text: 'old rivalry',
    what: 'past competition or resentment resurfaces at the worst moment',
    example: 'Two people who need each other keep arguing about what happened years ago',
  },
  {
    text: 'risky shortcut',
    what: 'someone chooses the fast dangerous route over the sensible one',
    example: 'The safer plan is abandoned because there is no time left',
  },
  {
    text: 'last supplies',
    what: 'a limited resource creates pressure on the group',
    example: 'The remaining food, fuel, money, or patience is counted out loud',
  },
  {
    text: 'hidden clue',
    what: 'a small detail reveals what is really happening',
    example: 'A background object suddenly matters once someone looks closer',
  },
  {
    text: 'public setback',
    what: 'a failure happens where everyone can see it',
    example: 'The big moment goes wrong in front of the exact crowd that matters',
  },
  {
    text: 'private doubt',
    what: 'a character admits they may not be able to finish the journey',
    example: 'Someone steps away from the group and says the quiet part out loud',
  },
  {
    text: 'team argument',
    what: 'the group splits over what to do next',
    example: 'A practical disagreement turns personal before anyone makes a decision',
  },
  {
    text: 'narrow escape',
    what: 'the characters barely get away from immediate danger or embarrassment',
    example: 'A door closes, a vehicle leaves, or a crowd shifts at the last possible second',
  },
  {
    text: 'unexpected ally',
    what: 'help arrives from someone the characters did not trust or notice',
    example: 'A person written off earlier quietly provides the thing everyone needs',
  },
  {
    text: 'broken promise',
    what: 'someone fails to keep a commitment and the consequences spread',
    example: 'A promise made in private becomes impossible to hide in public',
  },
  {
    text: 'midpoint reveal',
    what: 'new information changes the direction of the story halfway through',
    example: 'The plan still exists, but the reason for it is suddenly different',
  },
  {
    text: 'training attempt',
    what: 'a skill is practiced before it matters for real',
    example: 'The first try is clumsy, but one detail clearly gets better',
  },
  {
    text: 'wrong turn',
    what: 'a choice of direction or strategy makes everything worse',
    example: 'Someone insists they know the way, then immediately proves they do not',
  },
  {
    text: 'crossing danger',
    what: 'the characters must pass through a place where turning back is impossible',
    example: 'Everyone commits to the crossing before seeing how bad it is',
  },
  {
    text: 'lost signal',
    what: 'communication fails when the group most needs outside help',
    example: 'The call, broadcast, headset, or connection drops at the worst possible moment',
  },
  {
    text: 'storm delay',
    what: 'weather or bad conditions force an unwanted pause',
    example: 'The group watches the conditions worsen while the deadline keeps moving closer',
  },
  {
    text: 'legend explained',
    what: 'someone explains the history or myth behind the current problem',
    example: 'A story everyone dismissed starts matching the evidence in front of them',
  },
  {
    text: 'enemy trap',
    what: 'the opposition predicts what the leads will do',
    example: 'The obvious safe move turns out to be exactly what someone wanted',
  },
  {
    text: 'decoy plan',
    what: 'one plan is used to distract from the real one',
    example: 'The noisy mistake is revealed to have been intentional all along',
  },
  {
    text: 'high-stakes bet',
    what: 'someone risks reputation, safety, or relationships on a single outcome',
    example: 'The character commits before knowing whether anyone else will back them',
  },
  {
    text: 'quiet farewell',
    what: 'a goodbye lands softly before the story moves on',
    example: 'Two characters share a few words while everyone else is already leaving',
  },
  {
    text: 'final route',
    what: 'the last path forward is chosen with no easy backup',
    example: 'A map is folded away and the group commits to one remaining option',
  },
  {
    text: 'hidden passage',
    what: 'a way through appears where no one expected one',
    example: 'A wall, door, service route, or backstage path opens into a new possibility',
  },
  {
    text: 'tool failure',
    what: 'equipment breaks or underperforms right when it matters',
    example: 'The device works during practice and fails in the real moment',
  },
  {
    text: 'close rescue',
    what: 'someone is saved with almost no time to spare',
    example: 'A hand grabs a sleeve just before the situation becomes irreversible',
  },
  {
    text: 'double cross',
    what: 'a trusted person reveals a competing agenda',
    example: 'The helper turns out to have been steering the group toward their own goal',
  },
  {
    text: 'moral choice',
    what: 'the lead must choose between winning and doing the right thing',
    example: 'The easy victory is available, but taking it would betray someone vulnerable',
  },
  {
    text: 'race home',
    what: 'characters rush back to protect what they left behind',
    example: 'A realization sends everyone sprinting back the way they came',
  },
  {
    text: 'villain offer',
    what: 'an opponent offers a tempting way out',
    example: 'The deal would solve one problem while creating a much worse one',
  },
  {
    text: 'last-minute repair',
    what: 'something broken is fixed just before it becomes useless',
    example: 'The repair finally catches as everyone is already shouting to leave',
  },
  {
    text: 'crowd reaction',
    what: 'bystanders respond in a way that raises the pressure',
    example: 'The room goes silent, erupts, or turns against the lead all at once',
  },
  {
    text: 'emotional confession',
    what: 'a character admits the feeling or truth they have avoided',
    example: 'The practical conversation becomes personal before anyone can stop it',
  },
  {
    text: 'climactic reversal',
    what: 'the expected ending turns sharply in another direction',
    example: 'The apparent loss becomes a win because of something planted earlier',
  },
  {
    text: 'costly victory',
    what: 'the goal is achieved, but not without a meaningful loss',
    example: 'Everyone gets what they came for and still has to sit with the price',
  },
  {
    text: 'aftermath silence',
    what: 'the story pauses after the chaos to let the result sink in',
    example: 'Nobody speaks for a moment after the dust settles',
  },
  {
    text: 'future tease',
    what: 'the ending hints that the story world keeps going',
    example: 'A small unresolved detail suggests this was not the final chapter',
  },
];

const contextByKey = new Map();
for (const genre of EXPANDED_GENRES) {
  contextByKey.set(`${genre.id}:general`, genre.label);
  for (const subgenre of EXPANDED_SUBGENRES_BY_GENRE[genre.id].filter((s) => s.id !== 'general')) {
    contextByKey.set(`${genre.id}:${subgenre.id}`, subgenre.label);
  }
}

function tropeText(context, beat) {
  return `${context} ${beat.text}`;
}

export const EXPANDED_TROPES = [];
export const EXPANDED_DESCRIPTIONS = {};

for (const [key, context] of contextByKey) {
  const [genre, subgenre] = key.split(':');
  for (const beat of BEATS) {
    const text = tropeText(context, beat);
    EXPANDED_TROPES.push({ text, genre, subgenres: [subgenre] });
    EXPANDED_DESCRIPTIONS[text] = {
      what: `A ${context.toLowerCase()} beat where ${beat.what}.`,
      example: `${beat.example} in a ${context.toLowerCase()} scene.`,
    };
  }
}
