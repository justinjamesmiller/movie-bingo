alter table public.bingo_room_members
  add column if not exists last_seen_at timestamptz not null default now();

create or replace function public.commit_bingo_gameplay_state(
  p_code text,
  p_expected_revision bigint,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  room_record public.bingo_rooms%rowtype;
  result jsonb;
begin
  select * into room_record from public.bingo_rooms where code = p_code for update;
  if not found or room_record.expires_at <= now() then
    return jsonb_build_object('error', 'room_not_found');
  end if;
  result := public.commit_bingo_room_state(p_code, p_expected_revision, p_state, room_record.expires_at);
  if coalesce((result->>'saved')::boolean, false) then
    update public.bingo_rooms set host_seen_at = room_record.host_seen_at where code = p_code;
  end if;
  return result;
end;
$function$;

revoke all on function public.commit_bingo_gameplay_state(text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.commit_bingo_gameplay_state(text, bigint, jsonb) to service_role;