create table if not exists public.bingo_rooms (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{4}$'),
  state jsonb not null,
  expires_at timestamptz not null,
  host_seen_at timestamptz not null default now(),
  host_recovery_player_id text default null,
  host_recovery_password_hash text default null,
  host_recovery_attempts integer not null default 0,
  host_recovery_window_started_at timestamptz not null default now(),
  host_recovery_locked_until timestamptz default null,
  created_at timestamptz not null default now()
);

alter table public.bingo_rooms
  add column if not exists host_recovery_player_id text,
  add column if not exists host_recovery_password_hash text,
  add column if not exists host_recovery_attempts integer not null default 0,
  add column if not exists host_recovery_window_started_at timestamptz not null default now(),
  add column if not exists host_recovery_locked_until timestamptz;

create table if not exists public.bingo_room_members (
  room_code text not null references public.bingo_rooms(code) on update cascade on delete cascade,
  player_id text not null check (player_id ~ '^p[a-z0-9]{1,20}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  is_host boolean not null default false,
  status text not null default 'pending' check (status in ('active', 'pending', 'revoked')),
  created_at timestamptz not null default now(),
  primary key (room_code, player_id)
);

create index if not exists bingo_room_members_user_room_idx
  on public.bingo_room_members (user_id, room_code);

create unique index if not exists bingo_one_pending_join_per_room_idx
  on public.bingo_room_members (room_code)
  where status = 'pending';

alter table public.bingo_rooms enable row level security;
alter table public.bingo_room_members enable row level security;

revoke all on public.bingo_rooms from anon, authenticated;
revoke all on public.bingo_room_members from anon, authenticated;
grant select on public.bingo_room_members to authenticated;

drop policy if exists "players can read their own room membership" on public.bingo_room_members;
create policy "players can read their own room membership"
  on public.bingo_room_members
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "room members can receive private game broadcasts" on realtime.messages;
create policy "room members can receive private game broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    extension in ('broadcast', 'presence')
    and exists (
      select 1
      from public.bingo_room_members as member
      where member.room_code = split_part(realtime.topic(), '-', 2)
        and member.user_id = (select auth.uid())
        and member.status = 'active'
    )
  );

drop policy if exists "room members can publish their presence" on realtime.messages;
create policy "room members can publish their presence"
  on realtime.messages
  for insert
  to authenticated
  with check (
    extension = 'presence'
    and exists (
      select 1
      from public.bingo_room_members as member
      where member.room_code = split_part(realtime.topic(), '-', 2)
        and member.user_id = (select auth.uid())
        and member.status = 'active'
    )
  );

create or replace function public.consume_bingo_host_recovery_attempt(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  room_record public.bingo_rooms%rowtype;
  v_now timestamptz := now();
begin
  select * into room_record
  from public.bingo_rooms
  where code = p_code
  for update;

  if not found or room_record.host_recovery_password_hash is null then
    return false;
  end if;

  if room_record.host_recovery_locked_until is not null
    and room_record.host_recovery_locked_until > v_now then
    return false;
  end if;

  if room_record.host_recovery_window_started_at < v_now - interval '15 minutes' then
    update public.bingo_rooms
    set host_recovery_window_started_at = v_now,
        host_recovery_attempts = 1,
        host_recovery_locked_until = null
    where code = p_code;
    return true;
  end if;

  if room_record.host_recovery_attempts >= 5 then
    update public.bingo_rooms
    set host_recovery_locked_until = v_now + interval '15 minutes'
    where code = p_code;
    return false;
  end if;

  update public.bingo_rooms
  set host_recovery_attempts = host_recovery_attempts + 1
  where code = p_code;
  return true;
end;
$function$;

revoke all on function public.consume_bingo_host_recovery_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_bingo_host_recovery_attempt(text) to service_role;