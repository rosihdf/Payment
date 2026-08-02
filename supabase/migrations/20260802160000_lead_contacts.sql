-- Phase 1A Block 1: Ansprechpartner (CRM-Grundlage)
-- Operative Daten im jsonb-Feld; Lead bleibt Anker.

create table if not exists public.lead_contacts (
  id text primary key,
  lead_id text not null references public.leads (id) on delete cascade,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_contacts_lead_idx on public.lead_contacts (lead_id);
create unique index if not exists lead_contacts_one_primary_uidx
  on public.lead_contacts (lead_id)
  where is_primary = true and is_active = true;

alter table public.lead_contacts enable row level security;

drop policy if exists lead_contacts_all on public.lead_contacts;
drop policy if exists lead_contacts_select on public.lead_contacts;
drop policy if exists lead_contacts_insert on public.lead_contacts;
drop policy if exists lead_contacts_update on public.lead_contacts;
drop policy if exists lead_contacts_delete_admin on public.lead_contacts;

create policy lead_contacts_select on public.lead_contacts
  for select to authenticated
  using (
    public.is_active_user()
    and public.can_access_lead(lead_id)
  );

create policy lead_contacts_insert on public.lead_contacts
  for insert to authenticated
  with check (
    public.is_active_user()
    and (
      public.is_admin()
      or (
        created_by_user_id = auth.uid()::text
        and public.can_access_lead(lead_id)
      )
    )
  );

create policy lead_contacts_update on public.lead_contacts
  for update to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or public.can_access_lead(lead_id)
    )
  )
  with check (
    public.is_active_user()
    and (
      public.is_admin()
      or public.can_access_lead(lead_id)
    )
  );

create policy lead_contacts_delete_admin on public.lead_contacts
  for delete to authenticated
  using (public.is_admin());
