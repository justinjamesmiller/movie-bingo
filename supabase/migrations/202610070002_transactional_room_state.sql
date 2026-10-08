alter table public.bingo_rooms
  add column if not exists revision bigint not null default 0;

update public.bingo_rooms
set state = jsonb_set(state, '{serverRevision}', to_jsonb(revision), true)
where state->'serverRevision' is null;

create or replace function public.commit_bingo_room_state(
  p_code text,
  p_expected_revision bigint,
  p_state jsonb,
  p_expires_at timestamptz,
  p_new_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  room_record public.bingo_rooms%rowtype;
  current_revision bigint;
  target_code text := coalesce(p_new_code, p_code);
  pending_player_id text;
  committed_state jsonb;
begin
  if p_code is null
    or p_code !~ '^[A-HJ-NP-Z2-9]{4}$'
    or target_code !~ '^[A-HJ-NP-Z2-9]{4}$'
    or p_expected_revision is null
    or p_expected_revision < 0
    or jsonb_typeof(p_state) <> 'object'
    or p_state->>'code' is distinct from target_code
    or jsonb_typeof(p_state->'players') <> 'object'
    or jsonb_typeof(p_state->'hostIds') <> 'array'
    or jsonb_typeof(p_state->'acceptedTropes') <> 'array'
  then
    return jsonb_build_object('error', 'invalid_state');
  end if;

  select * into room_record
  from public.bingo_rooms
  where code = p_code
  for update;

  if not found then
    return jsonb_build_object('error', 'room_not_found');
  end if;

  current_revision := room_record.revision;
  if current_revision <> p_expected_revision then
    return jsonb_build_object(
      'conflict', true,
      'revision', current_revision,
      'state', room_record.state,
      'code', room_record.code
    );
  end if;

  if (select count(*) from jsonb_object_keys(p_state->'players')) > 32 then
    return jsonb_build_object('error', 'room_full');
  end if;

  pending_player_id := p_state->'pendingJoinRequest'->>'id';
  update public.bingo_room_members as member
  set status = case
        when (p_state->'players') ? member.player_id then 'active'
        when pending_player_id = member.player_id then 'pending'
        when member.status in ('pending', 'active') then 'revoked'
        else member.status
      end,
      is_host = (p_state->'hostIds') @> to_jsonb(member.player_id)
  where member.room_code = p_code;

    committed_state := jsonb_set(p_state, '{serverRevision}', to_jsonb(current_revision + 1), true);

  update public.bingo_rooms
  set code = target_code,
      state = committed_state,
      revision = current_revision + 1,
      expires_at = coalesce(p_expires_at, room_record.expires_at),
      host_seen_at = now()
  where code = p_code;

  return jsonb_build_object(
    'saved', true,
    'revision', current_revision + 1,
    'code', target_code,
    'state', committed_state
  );
end;
$function$;

revoke all on function public.commit_bingo_room_state(text, bigint, jsonb, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.commit_bingo_room_state(text, bigint, jsonb, timestamptz, text)
  to service_role;

create or replace function public.recover_bingo_host(
  p_code text,
  p_player_id text,
  p_user_id uuid,
  p_name text,
  p_expected_password_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  room_record public.bingo_rooms%rowtype;
  player_record jsonb;
  recovered_state jsonb;
  current_revision bigint;
  affected_members integer;
begin
  select * into room_record
  from public.bingo_rooms
  where code = p_code
  for update;

  if not found
    or room_record.expires_at <= now()
    or coalesce((room_record.state->>'gameOver')::boolean, false)
  then
    return jsonb_build_object('error', 'not_recoverable');
  end if;

  if room_record.host_recovery_password_hash is distinct from p_expected_password_hash
    or room_record.host_recovery_player_id is distinct from p_player_id
  then
    return jsonb_build_object('error', 'password_changed');
  end if;

  if not (room_record.state->'hostIds') @> to_jsonb(p_player_id) then
    return jsonb_build_object('error', 'host_seat_missing');
  end if;
  player_record := room_record.state->'players'->p_player_id;
  if player_record is null then
    return jsonb_build_object('error', 'host_seat_missing');
  end if;
  if coalesce((player_record->>'connected')::boolean, false)
    and room_record.host_seen_at > now() - interval '60 seconds'
  then
    return jsonb_build_object('error', 'host_still_connected');
  end if;

  update public.bingo_room_members
  set user_id = p_user_id,
      status = 'active'
  where room_code = p_code
    and player_id = p_player_id
    and is_host = true
    and status <> 'revoked';
  get diagnostics affected_members = row_count;
  if affected_members <> 1 then
    return jsonb_build_object('error', 'host_membership_missing');
  end if;

  recovered_state := jsonb_set(room_record.state, array['players', p_player_id, 'connected'], 'true'::jsonb, false);
  if coalesce(trim(p_name), '') <> '' then
    recovered_state := jsonb_set(
      recovered_state,
      array['players', p_player_id, 'name'],
      to_jsonb(left(trim(p_name), 20)),
      false
    );
  end if;
  current_revision := room_record.revision + 1;
  recovered_state := jsonb_set(recovered_state, '{serverRevision}', to_jsonb(current_revision), true);
  recovered_state := jsonb_set(
    recovered_state,
    '{rev}',
    to_jsonb(coalesce((room_record.state->>'rev')::bigint, 0) + 1),
    true
  );
  update public.bingo_rooms
  set state = recovered_state,
      revision = current_revision,
      host_seen_at = now(),
      host_recovery_attempts = 0,
      host_recovery_window_started_at = now(),
      host_recovery_locked_until = null
  where code = p_code
  returning state into recovered_state;

  return jsonb_build_object(
    'ok', true,
    'playerId', p_player_id,
    'revision', current_revision,
    'state', recovered_state
  );
end;
$function$;

revoke all on function public.recover_bingo_host(text, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.recover_bingo_host(text, text, uuid, text, text)
  to service_role;
