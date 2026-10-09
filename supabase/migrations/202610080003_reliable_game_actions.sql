create table public.bingo_action_receipts (
  room_code text not null references public.bingo_rooms(code) on update cascade on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  player_id text not null,
  action_hash text not null,
  created_at timestamptz not null default now(),
  primary key (room_code, user_id, request_id)
);
alter table public.bingo_action_receipts enable row level security;
revoke all on public.bingo_action_receipts from public, anon, authenticated;
create index bingo_action_receipts_expiry_idx on public.bingo_action_receipts(created_at);

create function public.commit_bingo_action(
  p_code text, p_expected_revision bigint, p_state jsonb,
  p_user_id uuid, p_player_id text, p_request_id uuid, p_action_hash text
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  room_record public.bingo_rooms%rowtype;
  receipt public.bingo_action_receipts%rowtype;
  result jsonb;
begin
  select * into room_record from public.bingo_rooms where code = p_code for update;
  if not found or room_record.expires_at <= now() then
    return jsonb_build_object('error', 'room_not_found');
  end if;
  if not exists (select 1 from public.bingo_room_members where room_code = p_code
    and player_id = p_player_id and user_id = p_user_id and status = 'active') then
    return jsonb_build_object('error', 'membership_required');
  end if;
  if p_request_id is null or p_action_hash is null or p_action_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('error', 'invalid_request');
  end if;
  select * into receipt from public.bingo_action_receipts
    where room_code = p_code and user_id = p_user_id and request_id = p_request_id;
  if found then
    if receipt.action_hash <> p_action_hash or receipt.player_id <> p_player_id then
      return jsonb_build_object('error', 'request_id_reused');
    end if;
    return jsonb_build_object('saved', true, 'replayed', true, 'state', room_record.state, 'revision', room_record.revision);
  end if;
  result := public.commit_bingo_gameplay_state(p_code, p_expected_revision, p_state);
  if coalesce((result->>'saved')::boolean, false) then
    insert into public.bingo_action_receipts(room_code, user_id, request_id, player_id, action_hash)
    values(p_code, p_user_id, p_request_id, p_player_id, p_action_hash);
    delete from public.bingo_action_receipts where created_at < now() - interval '24 hours';
  end if;
  return result;
end;
$function$;
revoke all on function public.commit_bingo_action(text,bigint,jsonb,uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.commit_bingo_action(text,bigint,jsonb,uuid,text,uuid,text) to service_role;

create function public.claim_bingo_seat(p_code text, p_user_id uuid, p_current_id text, p_seat_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  room_record public.bingo_rooms%rowtype;
  recovered_state jsonb;
  next_revision bigint;
begin
  select * into room_record from public.bingo_rooms where code = p_code for update;
  if not found or room_record.expires_at <= now() then
    return jsonb_build_object('error', 'room_not_found');
  end if;
  if p_current_id = p_seat_id or not (room_record.state->'players') ? p_seat_id
    or coalesce((room_record.state->'players'->p_seat_id->>'connected')::boolean, true)
    or (room_record.state->'hostIds') @> to_jsonb(p_seat_id) then
    return jsonb_build_object('error', 'seat_unavailable');
  end if;
  if not exists (select 1 from public.bingo_room_members where room_code = p_code
    and player_id = p_current_id and user_id = p_user_id and not is_host and status <> 'revoked')
    or not exists (select 1 from public.bingo_room_members where room_code = p_code
    and player_id = p_seat_id and user_id = p_user_id and not is_host and status <> 'revoked') then
    return jsonb_build_object('error', 'membership_required');
  end if;
  delete from public.bingo_room_members where room_code = p_code and player_id = p_seat_id;
  update public.bingo_room_members set player_id = p_seat_id, status = 'active', last_seen_at = now()
    where room_code = p_code and player_id = p_current_id and user_id = p_user_id;
  if not found then raise exception 'Seat transfer failed'; end if;
  next_revision := room_record.revision + 1;
  recovered_state := jsonb_set(room_record.state, array['players', p_seat_id, 'connected'], 'true'::jsonb, false);
  recovered_state := jsonb_set(recovered_state, '{serverRevision}', to_jsonb(next_revision), true);
  recovered_state := jsonb_set(recovered_state, '{rev}', to_jsonb(coalesce((recovered_state->>'rev')::bigint, 0) + 1), true);
  update public.bingo_rooms set state = recovered_state, revision = next_revision where code = p_code;
  return jsonb_build_object('playerId', p_seat_id, 'state', recovered_state, 'revision', next_revision);
end;
$function$;
revoke all on function public.claim_bingo_seat(text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.claim_bingo_seat(text,uuid,text,text) to service_role;