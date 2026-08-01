-- Keepalive für Free-Tier-Pausierung: eine harmlose Systemzeile + RPC

create table if not exists public.system_keepalive (
  id smallint primary key check (id = 1),
  last_seen_at timestamptz not null default now(),
  note text not null default 'amrtech-payment keepalive'
);

insert into public.system_keepalive (id, last_seen_at, note)
values (1, now(), 'amrtech-payment keepalive')
on conflict (id) do nothing;

alter table public.system_keepalive enable row level security;

-- Kein direkter Tabellenzugriff für anon/authenticated
revoke all on public.system_keepalive from anon, authenticated;

create or replace function public.touch_system_keepalive(p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text := nullif(current_setting('app.keepalive_token', true), '');
  updated_at timestamptz;
begin
  -- Wenn app.keepalive_token gesetzt ist, muss der Token passen.
  -- Ohne gesetztes Setting ist die RPC eng begrenzt (nur diese eine Zeile).
  if expected is not null and expected <> '' then
    if p_token is null or p_token <> expected then
      raise exception 'keepalive unauthorized' using errcode = '42501';
    end if;
  end if;

  update public.system_keepalive
  set last_seen_at = now()
  where id = 1
  returning last_seen_at into updated_at;

  if updated_at is null then
    insert into public.system_keepalive (id, last_seen_at, note)
    values (1, now(), 'amrtech-payment keepalive')
    returning last_seen_at into updated_at;
  end if;

  return jsonb_build_object(
    'ok', true,
    'last_seen_at', updated_at
  );
end;
$$;

revoke all on function public.touch_system_keepalive(text) from public;
grant execute on function public.touch_system_keepalive(text) to anon, authenticated, service_role;
