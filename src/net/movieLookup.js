// Looks up a movie's genres via the OMDb API (which sources its data from
// IMDb) so a host can auto-populate this app's genre selection from just a
// movie title instead of picking genres manually. Requires a free API key
// from https://www.omdbapi.com (VITE_OMDB_API_KEY) -- if missing, lookup is
// simply unavailable (callers should hide/disable the search UI).
const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY;

// OMDb/IMDb genre strings mapped to this app's internal genre ids. Genres
// IMDb reports that this app doesn't (yet) model (Documentary, Animation,
// Family, War, Western, Musical, Sport, Biography, History, Music) are left
// unmapped -- surfaced to the caller as `unmapped` so the UI can say so.
const GENRE_MAP = {
  Action: 'action',
  Adventure: 'action',
  Comedy: 'comedy',
  Crime: 'thriller',
  Drama: 'romance',
  Fantasy: 'fantasy',
  Horror: 'horror',
  Mystery: 'thriller',
  Romance: 'romance',
  'Sci-Fi': 'sci-fi',
  Thriller: 'thriller',
};

export function isMovieLookupAvailable() {
  return !!OMDB_API_KEY;
}

export async function lookupMovie(title) {
  const trimmed = (title || '').trim();
  if (!trimmed) throw new Error('Enter a movie title to search.');
  if (!OMDB_API_KEY) throw new Error("Movie lookup isn't configured (missing VITE_OMDB_API_KEY).");

  let res;
  try {
    res = await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(OMDB_API_KEY)}&t=${encodeURIComponent(trimmed)}`);
  } catch {
    throw new Error('Could not reach the movie database. Check your connection and try again.');
  }
  if (!res.ok) throw new Error('Could not reach the movie database.');
  const data = await res.json();
  if (data.Response === 'False') throw new Error(data.Error || 'Movie not found.');

  const omdbGenres = (data.Genre || '').split(',').map((g) => g.trim()).filter(Boolean);
  const genres = [];
  const unmapped = [];
  for (const g of omdbGenres) {
    const mapped = GENRE_MAP[g];
    if (mapped) {
      if (!genres.includes(mapped)) genres.push(mapped);
    } else {
      unmapped.push(g);
    }
  }

  return { title: data.Title, year: data.Year, genres, unmapped };
}
