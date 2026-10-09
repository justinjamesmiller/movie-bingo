create or replace function public.commit_bingo_action(
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
  if room_record.revision <> p_expected_revision then
    return jsonb_build_object('conflict', true, 'state', room_record.state, 'revision', room_record.revision);
  end if;
  if p_state = room_record.state then
    result := jsonb_build_object('saved', true, 'unchanged', true, 'state', room_record.state, 'revision', room_record.revision);
  else
    result := public.commit_bingo_gameplay_state(p_code, p_expected_revision, p_state);
  end if;
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
