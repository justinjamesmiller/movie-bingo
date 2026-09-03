// Optional enhancement on top of movieLookup.js: Wikidata's "genre" property
// (P136) on film entries often includes much more specific tags than OMDb's
// broad Genre field (e.g. "slasher film", "zombie film", "heist film") -- we
// use it to *suggest* sub-genre picks, since OMDb/IMDb alone only gives
// top-level genres. No API key or registration needed at all (Wikidata's
// public SPARQL endpoint is free/open); this is inherently best-effort since
// Wikidata's genre labels are free text (not a fixed enum), so
// LABEL_SUBGENRE_MAP below is a hand-picked set of common phrasings, not
// exhaustive.
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

export function isWikidataLookupAvailable() {
  return true;
}

// Each entry: if ANY of `match` appears as a substring of ANY Wikidata genre
// label for the film (already lowercased), suggest that {genre, subgenre}.
const LABEL_SUBGENRE_MAP = [
  { match: ['slasher'], genre: 'horror', subgenre: 'slasher' },
  {
    match: ['haunted house', 'haunting', 'possession', 'exorcism', 'supernatural', 'ghost', 'seance'],
    genre: 'horror',
    subgenre: 'supernatural',
  },
  { match: ['zombie', 'undead', 'outbreak', 'infection'], genre: 'horror', subgenre: 'zombie' },
  { match: ['found footage'], genre: 'horror', subgenre: 'found-footage' },
  { match: ['psychological horror', 'psychological thriller'], genre: 'horror', subgenre: 'psychological' },
  { match: ['monster', 'creature', 'kaiju'], genre: 'horror', subgenre: 'creature' },
  { match: ['heist', 'caper'], genre: 'action', subgenre: 'heist' },
  { match: ['spy', 'espionage'], genre: 'action', subgenre: 'spy-espionage' },
  { match: ['martial arts', 'kung fu', 'karate', 'wuxia'], genre: 'action', subgenre: 'martial-arts' },
  { match: ['disaster'], genre: 'action', subgenre: 'disaster' },
  { match: ['space opera', 'space western'], genre: 'sci-fi', subgenre: 'space-opera' },
  { match: ['dystopia', 'dystopian', 'post-apocalyptic'], genre: 'sci-fi', subgenre: 'dystopian' },
  { match: ['sword and sorcery', 'high fantasy', 'epic fantasy'], genre: 'fantasy', subgenre: 'epic-fantasy' },
  { match: ['fairy tale', 'fable'], genre: 'fantasy', subgenre: 'fairy-tale' },
  {
    match: ['whodunit', 'murder mystery', 'detective fiction', 'mystery film'],
    genre: 'thriller',
    subgenre: 'mystery-whodunit',
  },
  { match: ['film noir', 'neo-noir'], genre: 'thriller', subgenre: 'noir-crime' },
  { match: ['romantic comedy'], genre: 'comedy', subgenre: 'rom-com' },
  { match: ['parody', 'spoof', 'mockumentary'], genre: 'comedy', subgenre: 'spoof-parody' },
  { match: ['buddy film', 'buddy cop'], genre: 'comedy', subgenre: 'buddy-comedy' },
  { match: ['workplace comedy'], genre: 'comedy', subgenre: 'workplace' },
  { match: ['period drama', 'costume drama', 'regency romance'], genre: 'romance', subgenre: 'period-romance' },
  { match: ['melodrama', 'romantic drama'], genre: 'romance', subgenre: 'romantic-drama' },
  { match: ['legal drama', 'courtroom'], genre: 'drama', subgenre: 'legal' },
  { match: ['family drama', 'family film'], genre: 'drama', subgenre: 'family-drama' },
  { match: ['true crime'], genre: 'documentary', subgenre: 'true-crime' },
  { match: ['nature documentary', 'wildlife'], genre: 'documentary', subgenre: 'nature' },
  { match: ['pirate', 'swashbuckler'], genre: 'adventure', subgenre: 'pirate' },
  { match: ['treasure hunt', 'treasure'], genre: 'adventure', subgenre: 'treasure-hunt' },
  { match: ['survival film', 'survival'], genre: 'adventure', subgenre: 'survival' },
  { match: ['computer animation', 'cgi'], genre: 'animation', subgenre: 'computer-animation' },
  { match: ['stop motion', 'stop-motion'], genre: 'animation', subgenre: 'stop-motion' },
  { match: ['anime'], genre: 'animation', subgenre: 'anime' },
  { match: ['music biopic', 'musical biographical'], genre: 'biography', subgenre: 'music-biopic' },
  { match: ['sports biopic', 'sports biography'], genre: 'biography', subgenre: 'sports-biopic' },
  { match: ['political biography', 'political biopic'], genre: 'biography', subgenre: 'political-biopic' },
  { match: ['family comedy'], genre: 'family', subgenre: 'family-comedy' },
  { match: ['family adventure'], genre: 'family', subgenre: 'family-adventure' },
  { match: ["children's fantasy", 'childrens fantasy'], genre: 'family', subgenre: 'children-fantasy' },
  { match: ['historical drama'], genre: 'history', subgenre: 'historical-drama' },
  { match: ['historical epic'], genre: 'history', subgenre: 'historical-epic' },
  { match: ['historical romance'], genre: 'history', subgenre: 'historical-romance' },
  { match: ['concert film'], genre: 'music', subgenre: 'concert-film' },
  { match: ['music documentary'], genre: 'music', subgenre: 'music-documentary' },
  { match: ['jukebox musical'], genre: 'musical', subgenre: 'jukebox-musical' },
  { match: ['animated musical'], genre: 'musical', subgenre: 'animated-musical' },
  { match: ['sports drama'], genre: 'sport', subgenre: 'sports-drama' },
  { match: ['sports comedy'], genre: 'sport', subgenre: 'sports-comedy' },
  { match: ['racing film', 'auto racing'], genre: 'sport', subgenre: 'racing' },
  { match: ['anti-war', 'anti war'], genre: 'war', subgenre: 'anti-war' },
  { match: ['prisoner of war', 'prisoner-of-war'], genre: 'war', subgenre: 'prisoner-of-war' },
  { match: ['combat film'], genre: 'war', subgenre: 'combat' },
  { match: ['revisionist western'], genre: 'western', subgenre: 'revisionist-western' },
  { match: ['space western'], genre: 'western', subgenre: 'space-western' },
  { match: ['reality television', 'reality tv'], genre: 'tv', subgenre: 'reality-tv' },
  { match: ['game show'], genre: 'tv', subgenre: 'game-show' },
  { match: ['talk show'], genre: 'tv', subgenre: 'talk-show' },
];

// Returns a list of `{genre, subgenre}` suggestions for an IMDb id, or an
// empty list if the film isn't found on Wikidata or nothing recognizable
// matched -- callers should treat this as a bonus, not something to fail
// loudly on.
export async function getSuggestedSubgenres(imdbID) {
  if (!imdbID) return [];
  const query = `
    SELECT ?genreLabel WHERE {
      ?film wdt:P345 "${imdbID}".
      ?film wdt:P136 ?genre.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;
  try {
    const res = await fetch(`${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`, {
      headers: { Accept: 'application/sparql-results+json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const labels = (data.results?.bindings || []).map((b) => (b.genreLabel?.value || '').toLowerCase());

    const suggestions = [];
    const seen = new Set();
    for (const entry of LABEL_SUBGENRE_MAP) {
      const hit = entry.match.some((phrase) => labels.some((label) => label.includes(phrase)));
      if (!hit) continue;
      const key = `${entry.genre}::${entry.subgenre}`;
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push({ genre: entry.genre, subgenre: entry.subgenre });
    }
    return suggestions;
  } catch {
    return [];
  }
}
