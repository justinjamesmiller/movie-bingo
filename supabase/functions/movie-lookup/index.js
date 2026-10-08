import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createMovieLookupHandler } from './handler.js';

const service = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(
  createMovieLookupHandler({
    apiKey: Deno.env.get('OMDB_API_KEY'),
    async authenticate(request) {
      const authorization = request.headers.get('authorization');
      if (!authorization?.startsWith('Bearer ')) return null;
      const { data, error } = await service.auth.getUser(authorization.slice(7));
      return error ? null : data.user;
    },
    async consumeBudget(userId) {
      const { data, error } = await service.rpc('consume_bingo_movie_lookup', { p_user_id: userId });
      if (error) throw new Error('Could not check movie lookup budget.');
      return data === true;
    },
  }),
);
