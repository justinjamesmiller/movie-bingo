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
  { match: ['haunted house', 'haunting', 'possession', 'exorcism', 'supernatural', 'ghost', 'seance'], genre: 'horror', subgenre: 'supernatural' },
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
  { match: ['whodunit', 'murder mystery', 'detective fiction', 'mystery film'], genre: 'thriller', subgenre: 'mystery-whodunit' },
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
