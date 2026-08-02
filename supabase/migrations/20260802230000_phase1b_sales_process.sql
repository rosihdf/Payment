-- Phase 1B Block 2: Share-Links, Rückfragen, Änderungswünsche, Annahme, BestPay-Handoff
-- Additive Migration – keine destruktiven Operationen

-- ---------------------------------------------------------------------------
-- offer_share_links
-- ---------------------------------------------------------------------------

create table if not exists public.offer_share_links (
  id text primary key,
  offer_id text not null references public.offers (id) on delete cascade,
  offer_version_id text not null references public.offer_versions (id) on delete cascade,
  token_hash text not null,
  status text not null default 'active',
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  revoked_at timestamptz,
  superseded_at timestamptz,
  access_count integer not null default 0,
  last_accessed_at timestamptz,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_share_links_token_hash_uidx unique (token_hash),
  constraint offer_share_links_status_check check (
    status in ('active', 'expired', 'revoked', 'superseded')
  )
);

create index if not exists offer_share_links_offer_idx on public.offer_share_links (offer_id);
create index if not exists offer_share_links_version_idx on public.offer_share_links (offer_version_id);

create unique index if not exists offer_share_links_one_active_per_offer
  on public.offer_share_links (offer_id)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- offer_customer_questions
-- ---------------------------------------------------------------------------

create table if not exists public.offer_customer_questions (
  id text primary key,
  offer_id text not null references public.offers (id) on delete cascade,
  offer_version_id text not null references public.offer_versions (id) on delete cascade,
  share_id text references public.offer_share_links (id) on delete set null,
  question_text text not null,
  customer_name text,
  customer_email text,
  status text not null default 'open',
  answer_text text,
  answered_by_user_id text,
  asked_at timestamptz not null,
  answered_at timestamptz,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_customer_questions_status_check check (
    status in ('open', 'answered', 'closed')
  )
);

create index if not exists offer_customer_questions_offer_idx
  on public.offer_customer_questions (offer_id);
create index if not exists offer_customer_questions_version_idx
  on public.offer_customer_questions (offer_version_id);

-- ---------------------------------------------------------------------------
-- offer_change_requests
-- ---------------------------------------------------------------------------

create table if not exists public.offer_change_requests (
  id text primary key,
  offer_id text not null references public.offers (id) on delete cascade,
  offer_version_id text not null references public.offer_versions (id) on delete cascade,
  share_id text references public.offer_share_links (id) on delete set null,
  request_text text not null,
  customer_name text,
  customer_email text,
  status text not null default 'open',
  handled_by_user_id text,
  handled_at timestamptz,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_change_requests_status_check check (
    status in ('open', 'reviewed', 'answered', 'completed')
  )
);

create index if not exists offer_change_requests_offer_idx
  on public.offer_change_requests (offer_id);
create index if not exists offer_change_requests_version_idx
  on public.offer_change_requests (offer_version_id);

-- ---------------------------------------------------------------------------
-- offer_customer_acceptances
-- ---------------------------------------------------------------------------

create table if not exists public.offer_customer_acceptances (
  id text primary key,
  offer_id text not null references public.offers (id) on delete cascade,
  offer_version_id text not null references public.offer_versions (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_customer_acceptances_version_uidx unique (offer_version_id)
);

create index if not exists offer_customer_acceptances_offer_idx
  on public.offer_customer_acceptances (offer_id);

-- ---------------------------------------------------------------------------
-- bestpay_handoffs
-- ---------------------------------------------------------------------------

create table if not exists public.bestpay_handoffs (
  id text primary key,
  offer_id text not null references public.offers (id) on delete cascade,
  offer_version_id text not null references public.offer_versions (id) on delete cascade,
  acceptance_id text references public.offer_customer_acceptances (id) on delete set null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bestpay_handoffs_offer_idx on public.bestpay_handoffs (offer_id);
create index if not exists bestpay_handoffs_version_idx on public.bestpay_handoffs (offer_version_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.offer_share_links enable row level security;
alter table public.offer_customer_questions enable row level security;
alter table public.offer_change_requests enable row level security;
alter table public.offer_customer_acceptances enable row level security;
alter table public.bestpay_handoffs enable row level security;

drop policy if exists offer_share_links_all on public.offer_share_links;
create policy offer_share_links_all on public.offer_share_links for all to authenticated
  using (public.is_active_user() and public.can_access_offer(offer_id))
  with check (public.is_active_user() and public.can_access_offer(offer_id));

drop policy if exists offer_customer_questions_all on public.offer_customer_questions;
create policy offer_customer_questions_all on public.offer_customer_questions for all to authenticated
  using (public.is_active_user() and public.can_access_offer(offer_id))
  with check (public.is_active_user() and public.can_access_offer(offer_id));

drop policy if exists offer_change_requests_all on public.offer_change_requests;
create policy offer_change_requests_all on public.offer_change_requests for all to authenticated
  using (public.is_active_user() and public.can_access_offer(offer_id))
  with check (public.is_active_user() and public.can_access_offer(offer_id));

drop policy if exists offer_customer_acceptances_all on public.offer_customer_acceptances;
create policy offer_customer_acceptances_all on public.offer_customer_acceptances for all to authenticated
  using (public.is_active_user() and public.can_access_offer(offer_id))
  with check (public.is_active_user() and public.can_access_offer(offer_id));

drop policy if exists bestpay_handoffs_all on public.bestpay_handoffs;
create policy bestpay_handoffs_all on public.bestpay_handoffs for all to authenticated
  using (public.is_active_user() and public.can_access_offer(offer_id))
  with check (public.is_active_user() and public.can_access_offer(offer_id));

-- Kein anonymer Tabellenzugriff – öffentliche Aktionen nur über Worker
revoke all on public.offer_share_links from anon;
revoke all on public.offer_customer_questions from anon;
revoke all on public.offer_change_requests from anon;
revoke all on public.offer_customer_acceptances from anon;
revoke all on public.bestpay_handoffs from anon;
