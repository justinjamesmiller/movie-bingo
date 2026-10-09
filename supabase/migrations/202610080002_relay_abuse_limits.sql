create table public.bingo_relay_request_budget (
  subject text primary key,
  requests integer not null default 0,
  window_started_at timestamptz not null default now()
);

alter table public.bingo_relay_request_budget enable row level security;
revoke all on public.bingo_relay_request_budget from public, anon, authenticated;
create index bingo_relay_request_budget_expiry_idx
  on public.bingo_relay_request_budget (window_started_at);

create function public.consume_bingo_relay_request(p_user_id uuid, p_operation text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_bucket public.bingo_relay_request_budget%rowtype;
  v_user text := 'user:' || p_user_id::text;
  v_category text;
  v_category_limit integer;
  v_category_seconds integer;
  v_subjects text[];
  v_limits integer[];
  v_windows integer[];
  v_retry integer := 0;
  v_index integer;
begin
  if p_user_id is null then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', 60);
  end if;

  case p_operation
    when 'create' then v_category := 'create'; v_category_limit := 6; v_category_seconds := 600;
    when 'join' then v_category := 'join'; v_category_limit := 20; v_category_seconds := 60;
    when 'recover-host' then v_category := 'recovery'; v_category_limit := 10; v_category_seconds := 900;
    when 'set-host-recovery-password' then v_category := 'recovery'; v_category_limit := 10; v_category_seconds := 900;
    when 'publish' then v_category := 'publish'; v_category_limit := 480; v_category_seconds := 60;
    when 'join-status' then v_category := 'presence'; v_category_limit := 180; v_category_seconds := 60;
    when 'heartbeat' then v_category := 'presence'; v_category_limit := 180; v_category_seconds := 60;
    else v_category := 'control'; v_category_limit := 30; v_category_seconds := 60;
  end case;

  v_subjects := array['global:minute', 'global:day', v_user || ':all', v_user || ':' || v_category];
  v_limits := array[6000, 120000, 600, v_category_limit];
  v_windows := array[60, 86400, 60, v_category_seconds];
  if p_operation = 'create' then
    v_subjects := array['global:minute', 'global:day', 'global:create', v_user || ':all', v_user || ':' || v_category];
    v_limits := array[6000, 120000, 500, 600, v_category_limit];
    v_windows := array[60, 86400, 86400, 60, v_category_seconds];
  end if;

  for v_index in 1..array_length(v_subjects, 1) loop
    if v_retry > 0 and v_subjects[v_index] like 'user:%' then
      return jsonb_build_object('allowed', false, 'retry_after_seconds', v_retry);
    end if;
    insert into public.bingo_relay_request_budget (subject, window_started_at)
    values (v_subjects[v_index], v_now) on conflict (subject) do nothing;
    select * into v_bucket from public.bingo_relay_request_budget
    where subject = v_subjects[v_index] for update;
    if v_index = 1 then
      delete from public.bingo_relay_request_budget
      where subject like 'user:%' and window_started_at < v_now - interval '2 days';
    end if;
    if v_bucket.window_started_at <= v_now - make_interval(secs => v_windows[v_index]) then
      update public.bingo_relay_request_budget
      set requests = 0, window_started_at = v_now where subject = v_subjects[v_index];
      v_bucket.requests := 0;
      v_bucket.window_started_at := v_now;
    end if;
    if v_bucket.requests >= v_limits[v_index] then
      v_retry := greatest(v_retry, ceil(extract(epoch from
        v_bucket.window_started_at + make_interval(secs => v_windows[v_index]) - v_now))::integer);
    else
      update public.bingo_relay_request_budget set requests = requests + 1 where subject = v_subjects[v_index];
    end if;
  end loop;

  if v_retry > 0 then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', v_retry);
  end if;
  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$function$;

revoke all on function public.consume_bingo_relay_request(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_bingo_relay_request(uuid, text) to service_role;