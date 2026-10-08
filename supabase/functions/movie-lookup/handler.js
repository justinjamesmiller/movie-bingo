const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
      if (!parameter || !query || query.length > 120 || (body.mode === 'details' && !/^tt\d{7,10}$/.test(query))) {
        return json({ error: 'Enter a valid title or IMDb ID.' }, 400);
      }
      if (!(await consumeBudget(user.id))) {
        return json({ error: 'Movie lookup limit reached. Please try again later.' }, 429);
      }
      const upstream = new URL('https://www.omdbapi.com/');
      upstream.searchParams.set('apikey', apiKey);
      upstream.searchParams.set(parameter, query);
      const response = await fetchMovie(upstream, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return json({ error: 'Could not reach the movie database.' }, 502);
      const data = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data) || !['True', 'False'].includes(data.Response)) {
        return json({ error: 'The movie database returned an invalid response.' }, 502);
      }
      return json(data);
    } catch {
      return json({ error: 'Could not complete movie lookup. Please try again.' }, 502);
    }
  };
}
