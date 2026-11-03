const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_SEARCH_PAGES = 6;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function createMovieLookupHandler({ authenticate, consumeBudget, apiKey, fetchMovie = fetch }) {
  return async function handleMovieLookup(request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    try {
      const user = await authenticate(request);
      if (!user?.id) return json({ error: 'A valid sign-in session is required.' }, 401);
      if (!apiKey) return json({ error: 'Movie lookup is not configured on the server.' }, 503);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid lookup request.' }, 400);
      }
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return json({ error: 'Invalid lookup request.' }, 400);
      const parameters = { search: 's', details: 'i', title: 't' };
      const parameter = Object.hasOwn(parameters, body.mode) ? parameters[body.mode] : null;
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      const yearMatch = body.mode === 'search' ? query.match(/^(.*?)\s*\((\d{4})\)$/) : null;
      const searchTitle = yearMatch ? yearMatch[1].trim() : query;
      if (
        !parameter ||
        !query ||
        query.length > 120 ||
        !searchTitle ||
        (body.mode === 'details' && !/^tt\d{7,10}$/.test(query))
      ) {
        return json({ error: 'Enter a valid title or IMDb ID.' }, 400);
      }
      if (!(await consumeBudget(user.id))) {
        return json({ error: 'Movie lookup limit reached. Please try again later.' }, 429);
      }
      const upstream = new URL('https://www.omdbapi.com/');
      upstream.searchParams.set('apikey', apiKey);
      upstream.searchParams.set(parameter, body.mode === 'search' ? searchTitle : query);

      const fetchPage = async (url, chargeBudget = false) => {
        if (chargeBudget && !(await consumeBudget(user.id))) {
          return { error: json({ error: 'Movie lookup limit reached. Please try again later.' }, 429) };
        }
        const response = await fetchMovie(url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return { error: json({ error: 'Could not reach the movie database.' }, 502) };
        const data = await response.json();
        if (!data || typeof data !== 'object' || Array.isArray(data) || !['True', 'False'].includes(data.Response)) {
          return { error: json({ error: 'The movie database returned an invalid response.' }, 502) };
        }
        return { data };
      };

      if (body.mode !== 'search') {
        const result = await fetchPage(upstream);
        return result.error || json(result.data);
      }

      const requestedYear = yearMatch?.[2];
      const matchesRequestedYear = (year) =>
        !requestedYear || new RegExp(`^${requestedYear}(?:\\b|[-–])`).test(String(year || ''));
      const matchesExactTitle = (title) =>
        String(title || '')
          .trim()
          .toLowerCase() === searchTitle.toLowerCase();
      if (requestedYear) upstream.searchParams.set('y', requestedYear);
      upstream.searchParams.set('type', 'movie');
      const movieResult = await fetchPage(upstream);
      if (movieResult.error) return movieResult.error;

      const exactTitleIsInSearchResults =
        requestedYear &&
        (Array.isArray(movieResult.data.Search) ? movieResult.data.Search : []).some(
          (result) => matchesExactTitle(result.Title) && matchesRequestedYear(result.Year),
        );
      let exactTitleResult = null;
      let exactTitleLookups = 0;
      if (requestedYear && !exactTitleIsInSearchResults) {
        const exactTitleUrl = new URL(upstream);
        exactTitleUrl.searchParams.delete('s');
        exactTitleUrl.searchParams.delete('type');
        exactTitleUrl.searchParams.set('t', searchTitle);
        const exactResult = await fetchPage(exactTitleUrl, true);
        if (exactResult.error) return exactResult.error;
        exactTitleLookups = 1;
        if (
          exactResult.data.Response === 'True' &&
          matchesExactTitle(exactResult.data.Title) &&
          matchesRequestedYear(exactResult.data.Year) &&
          ['movie', 'series'].includes(exactResult.data.Type)
        ) {
          exactTitleResult = {
            imdbID: exactResult.data.imdbID,
            Title: exactResult.data.Title,
            Year: exactResult.data.Year,
            Type: exactResult.data.Type,
            Poster: exactResult.data.Poster,
          };
        }
      }

      const seriesUrl = new URL(upstream);
      seriesUrl.searchParams.set('type', 'series');
      const seriesResult = await fetchPage(seriesUrl, true);
      if (seriesResult.error) return seriesResult.error;

      const searchTypes = [
        { type: 'movie', data: movieResult.data, nextPage: 2 },
        { type: 'series', data: seriesResult.data, nextPage: 2 },
      ];
      if (exactTitleResult) {
        const matchingType = searchTypes.find((entry) => entry.type === exactTitleResult.Type);
        matchingType.data.Response = 'True';
        matchingType.data.totalResults = String(Math.max(Number(matchingType.data.totalResults) || 0, 1));
        matchingType.data.Search = [...(Array.isArray(matchingType.data.Search) ? matchingType.data.Search : [])];
        matchingType.data.Search.unshift(exactTitleResult);
      }
      let fetchedPages = 2 + exactTitleLookups;
      let nextType = 0;
      while (fetchedPages < MAX_SEARCH_PAGES) {
        let typeIndex = -1;
        for (let offset = 0; offset < searchTypes.length; offset += 1) {
          const candidateIndex = (nextType + offset) % searchTypes.length;
          const candidate = searchTypes[candidateIndex];
          if (
            candidate.data.Response === 'True' &&
            candidate.nextPage <= Math.ceil(Number(candidate.data.totalResults) / 10)
          ) {
            typeIndex = candidateIndex;
            break;
          }
        }
        if (typeIndex < 0) break;
        const entry = searchTypes[typeIndex];
        const pageUrl = new URL(upstream);
        pageUrl.searchParams.set('type', entry.type);
        pageUrl.searchParams.set('page', String(entry.nextPage));
        const pageResult = await fetchPage(pageUrl, true);
        if (pageResult.error) return pageResult.error;
        if (pageResult.data.Response !== 'True') {
          return json({ error: 'The movie database returned an invalid response.' }, 502);
        }
        entry.data.Search = [
          ...(Array.isArray(entry.data.Search) ? entry.data.Search : []),
          ...(Array.isArray(pageResult.data.Search) ? pageResult.data.Search : []),
        ];
        entry.nextPage += 1;
        fetchedPages += 1;
        nextType = (typeIndex + 1) % searchTypes.length;
      }

      const resultsByType = searchTypes.map(({ data }) =>
        (Array.isArray(data.Search) ? data.Search : []).filter((result) => matchesRequestedYear(result.Year)),
      );
      const Search = [];
      for (let index = 0; index < Math.max(...resultsByType.map((results) => results.length)); index += 1) {
        for (const results of resultsByType) {
          if (results[index]) Search.push(results[index]);
          if (Search.length === 50) break;
        }
        if (Search.length === 50) break;
      }
      if (!Search.length) {
        return json({ Response: 'False', Error: 'Movie not found!', totalResults: '0', Search: [] });
      }
      const totalResults = searchTypes.reduce((total, entry) => total + (Number(entry.data.totalResults) || 0), 0);
      return json({ Response: 'True', totalResults: String(totalResults), Search });
    } catch {
      return json({ error: 'Could not complete movie lookup. Please try again.' }, 502);
    }
  };
}
