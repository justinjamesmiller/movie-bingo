create table public.bingo_movie_lookup_budget (
  subject text primary key,
  requests integer not null default 0,
  window_started_at timestamptz not null default now()
);

alter table public.bingo_movie_lookup_budget enable row level security;
revoke all on public.bingo_movie_lookup_budget from public, anon, authenticated;

create function public.consume_bingo_movie_lookup(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := now();
  v_day timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_global public.bingo_movie_lookup_budget%rowtype;
  v_user public.bingo_movie_lookup_budget%rowtype;
  v_subject text := 'user:' || p_user_id::text;
begin
  if p_user_id is null then
    return false;
  end if;

  insert into public.bingo_movie_lookup_budget (subject, window_started_at)
  values ('global', v_day)
  on conflict (subject) do nothing;

  select * into v_global from public.bingo_movie_lookup_budget where subject = 'global' for update;
  if v_global.window_started_at < v_day then
    update public.bingo_movie_lookup_budget set requests = 0, window_started_at = v_day where subject = 'global';
    v_global.requests := 0;
  end if;
  if v_global.requests >= 900 then
    return false;
  end if;

  delete from public.bingo_movie_lookup_budget
  where subject <> 'global' and window_started_at < v_now - interval '2 days';
  insert into public.bingo_movie_lookup_budget (subject, window_started_at)
  values (v_subject, v_now)
  on conflict (subject) do nothing;
  select * into v_user from public.bingo_movie_lookup_budget where subject = v_subject for update;
  if v_user.window_started_at <= v_now - interval '1 minute' then
    update public.bingo_movie_lookup_budget set requests = 0, window_started_at = v_now where subject = v_subject;
    v_user.requests := 0;
  end if;
  if v_user.requests >= 30 then
    return false;
  end if;

  update public.bingo_movie_lookup_budget set requests = requests + 1 where subject in ('global', v_subject);
  return true;
end;
$function$;

revoke all on function public.consume_bingo_movie_lookup(uuid) from public, anon, authenticated;
grant execute on function public.consume_bingo_movie_lookup(uuid) to service_role;