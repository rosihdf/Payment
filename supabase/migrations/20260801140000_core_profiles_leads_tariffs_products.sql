-- Erster produktiver Block: profiles, leads, tariffs, products + RLS
-- Finale Instanz: vohnqrftkuefkugabcob
-- Kein DROP SCHEMA / keine destruktiven Reset-Operationen

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabellen zuerst (Funktionen referenzieren profiles)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email text not null default '',
  role text not null check (role in ('admin', 'field_service')),
  status text not null check (status in ('active', 'deactivated', 'invited')),
  sales_team_id text null,
  schema_version integer not null default 3,
  deactivated_at timestamptz null,
  last_access_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);

create table if not exists public.leads (
  id text primary key,
  company_name text not null,
  status text not null,
  assigned_sales_user_id text not null,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_assigned_idx on public.leads (assigned_sales_user_id);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_updated_idx on public.leads (updated_at desc);

create table if not exists public.tariffs (
  id text primary key,
  name text not null,
  product_code text not null,
  status text not null check (status in ('active', 'inactive')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tariffs_product_code_uidx on public.tariffs (product_code);
create index if not exists tariffs_status_idx on public.tariffs (status);

create table if not exists public.products (
  id text primary key,
  name text not null,
  internal_product_code text not null,
  category text not null,
  status text not null check (status in ('active', 'inactive')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_internal_code_uidx on public.products (internal_product_code);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_category_idx on public.products (category);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen (security definer, fester search_path)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.tariffs enable row level security;
alter table public.products enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin
  on public.profiles for insert
  to authenticated
  with check (public.is_admin() or user_id = auth.uid());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

drop policy if exists leads_select_policy on public.leads;
create policy leads_select_policy
  on public.leads for select
  to authenticated
  using (
    public.is_admin()
    or assigned_sales_user_id = auth.uid()::text
    or created_by_user_id = auth.uid()::text
  );

drop policy if exists leads_insert_policy on public.leads;
create policy leads_insert_policy
  on public.leads for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      created_by_user_id = auth.uid()::text
      and assigned_sales_user_id = auth.uid()::text
    )
  );

drop policy if exists leads_update_policy on public.leads;
create policy leads_update_policy
  on public.leads for update
  to authenticated
  using (
    public.is_admin()
    or assigned_sales_user_id = auth.uid()::text
    or created_by_user_id = auth.uid()::text
  )
  with check (
    public.is_admin()
    or assigned_sales_user_id = auth.uid()::text
    or created_by_user_id = auth.uid()::text
  );

drop policy if exists leads_delete_admin on public.leads;
create policy leads_delete_admin
  on public.leads for delete
  to authenticated
  using (public.is_admin());

drop policy if exists tariffs_select_authenticated on public.tariffs;
create policy tariffs_select_authenticated
  on public.tariffs for select
  to authenticated
  using (true);

drop policy if exists tariffs_insert_admin on public.tariffs;
create policy tariffs_insert_admin
  on public.tariffs for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists tariffs_update_admin on public.tariffs;
create policy tariffs_update_admin
  on public.tariffs for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists tariffs_delete_admin on public.tariffs;
create policy tariffs_delete_admin
  on public.tariffs for delete
  to authenticated
  using (public.is_admin());

drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated
  on public.products for select
  to authenticated
  using (true);

drop policy if exists products_insert_admin on public.products;
create policy products_insert_admin
  on public.products for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists products_update_admin on public.products;
create policy products_update_admin
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists products_delete_admin on public.products;
create policy products_delete_admin
  on public.products for delete
  to authenticated
  using (public.is_admin());

revoke all on public.profiles from anon;
revoke all on public.leads from anon;
revoke all on public.tariffs from anon;
revoke all on public.products from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.tariffs to authenticated;
grant select, insert, update, delete on public.products to authenticated;
