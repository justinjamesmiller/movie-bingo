// Looks up a movie or TV show's genres via the OMDb API (which sources its
// data from IMDb) so a host can auto-populate this app's genre selection
// from just a title instead of picking genres manually. Requests use the
// authenticated Supabase proxy; the OMDb API key stays on the server.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
let lookupClient;
let sessionRequest;

async function lookupSession() {
  lookupClient ||= createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!sessionRequest) {
    sessionRequest = (async () => {
      const { data, error } = await lookupClient.auth.getSession();
      if (error) throw error;
      if (data.session) return data.session;
      const signedIn = await lookupClient.auth.signInAnonymously();
      if (signedIn.error) throw signedIn.error;
      if (!signedIn.data.session) throw new Error('Could not sign in for movie lookup.');
      return signedIn.data.session;
    })().finally(() => {
      sessionRequest = null;
    });
  }
  return sessionRequest;
}

// OMDb/IMDb genre strings mapped to this app's internal genre ids. Genres
// IMDb reports that this app doesn't model are left unmapped -- surfaced to
// the caller as `unmapped` so the UI can say so.
const GENRE_MAP = {
  Action: 'action',
  Adventure: 'adventure',
  Animation: 'animation',
  Biography: 'biography',
  Comedy: 'comedy',
  Crime: 'thriller',
  Documentary: 'documentary',
  Drama: 'drama',
  Family: 'family',
  Fantasy: 'fantasy',
  'Game-Show': 'tv',
  History: 'history',
  Horror: 'horror',
  Music: 'music',
  Musical: 'musical',
  Mystery: 'thriller',
  News: 'tv',
  'Reality-TV': 'tv',
  Romance: 'romance',
  'Sci-Fi': 'sci-fi',
  Sport: 'sport',
  'Talk-Show': 'tv',
  Thriller: 'thriller',
  War: 'war',
  Western: 'western',
};

export function isMovieLookupAvailable() {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
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

async function omdbFetch(mode, query) {
  if (!isMovieLookupAvailable()) throw new Error("Movie lookup isn't configured (missing Supabase configuration).");
  let res;
  try {
    const session = await lookupSession();
    res = await fetch(`${SUPABASE_URL}/functions/v1/movie-lookup`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode, query }),
    });
  } catch {
    throw new Error('Could not reach the movie database. Check your connection and try again.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not reach the movie database.');
  return data;
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
  const data = await omdbFetch('search', trimmed);
  if (data.Response === 'False') throw new Error(data.Error || 'Nothing found with that title.');

  return (Array.isArray(data.Search) ? data.Search : [])
    .filter((m) => m.Type === 'movie' || m.Type === 'series')
    .map((m) => ({
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
  const data = await omdbFetch('details', imdbID);
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
  const data = await omdbFetch('title', trimmed);
  if (data.Response === 'False') throw new Error(data.Error || 'Title not found.');

  const { genres, unmapped } = mapGenres(data.Genre);
  return { title: data.Title, year: data.Year, type: data.Type, genres, unmapped };
}
