// Looks up a movie or TV show's genres via the OMDb API (which sources its
// data from IMDb) so a host can auto-populate this app's genre selection
// from just a title instead of picking genres manually. Requires a free API
// key from https://www.omdbapi.com (VITE_OMDB_API_KEY) -- if missing, lookup
// is simply unavailable (callers should hide/disable the search UI).
const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY;

// OMDb/IMDb genre strings mapped to this app's internal genre ids. Genres
// IMDb reports that this app doesn't (yet) model (Animation, Family, War,
// Western, Musical, Sport, Biography, History, Music) are left unmapped --
// surfaced to the caller as `unmapped` so the UI can say so.
const GENRE_MAP = {
  Action: 'action',
  Adventure: 'action',
  Comedy: 'comedy',
  Crime: 'thriller',
  Documentary: 'documentary',
  Drama: 'drama',
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

function mapGenres(genreString) {
  const omdbGenres = (genreString || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
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
  return { genres, unmapped };
}

async function omdbFetch(params) {
  if (!OMDB_API_KEY) throw new Error("Movie lookup isn't configured (missing VITE_OMDB_API_KEY).");
  let res;
  try {
    res = await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(OMDB_API_KEY)}&${params}`);
  } catch {
    throw new Error('Could not reach the movie database. Check your connection and try again.');
  }
  if (!res.ok) throw new Error('Could not reach the movie database.');
  return res.json();
}

// Searches by (partial) title across BOTH movies and TV series, returning up
// to 10 candidates so the user can pick the right one (OMDb's search
// endpoint only returns basic fields -- title/year/poster/id/type -- not
// genre, hence the separate detail lookup below). `type` ('movie'|'series')
// is surfaced so the UI can label each result and help the host disambiguate
// same-titled movies/shows.
export async function searchMovies(title) {
  const trimmed = (title || '').trim();
  if (!trimmed) throw new Error('Enter a movie or TV show title to search.');
  const data = await omdbFetch(`s=${encodeURIComponent(trimmed)}`);
  if (data.Response === 'False') throw new Error(data.Error || 'Nothing found with that title.');

  return data.Search.filter((m) => m.Type === 'movie' || m.Type === 'series').map((m) => ({
    imdbID: m.imdbID,
    title: m.Title,
    year: m.Year,
    type: m.Type,
    poster: m.Poster && m.Poster !== 'N/A' ? m.Poster : null,
  }));
}

// Fetches full details for one title by IMDb id (from searchMovies) --
// includes genre plus other identifying info (director, actors, poster) to
// help confirm it's the right pick. Works for both movies and TV series.
export async function getMovieDetails(imdbID) {
  const data = await omdbFetch(`i=${encodeURIComponent(imdbID)}`);
  if (data.Response === 'False') throw new Error(data.Error || 'Title not found.');

  const { genres, unmapped } = mapGenres(data.Genre);
  return {
    title: data.Title,
    year: data.Year,
    type: data.Type,
    poster: data.Poster && data.Poster !== 'N/A' ? data.Poster : null,
    director: data.Director && data.Director !== 'N/A' ? data.Director : null,
    actors: data.Actors && data.Actors !== 'N/A' ? data.Actors : null,
    genres,
    unmapped,
  };
}

// Convenience one-shot lookup (exact title match) kept for callers that just
// want the first/best match without showing a picker.
export async function lookupMovie(title) {
  const trimmed = (title || '').trim();
  if (!trimmed) throw new Error('Enter a movie or TV show title to search.');
  const data = await omdbFetch(`t=${encodeURIComponent(trimmed)}`);
  if (data.Response === 'False') throw new Error(data.Error || 'Title not found.');

  const { genres, unmapped } = mapGenres(data.Genre);
  return { title: data.Title, year: data.Year, type: data.Type, genres, unmapped };
}
