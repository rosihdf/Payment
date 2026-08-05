-- Genau einer aktiver Beratungsentwurf pro Kunde (kein Angebot, nicht verworfen).

-- Bestehende Dubletten: ältere aktive Entwürfe ohne Angebot verwerfen.
with ranked as (
  select
    id,
    lead_id,
    row_number() over (
      partition by lead_id
      order by coalesce((data->>'updatedAt')::timestamptz, updated_at) desc, created_at desc
    ) as rn
  from public.best_pay_comparison_sessions
  where lead_id is not null
    and offer_id is null
    and coalesce(data->>'status', '') not in ('discarded', 'offer_created')
    and coalesce(data->>'archivedAt', '') = ''
    and coalesce(data->'wizard'->>'wizardCompletedAt', '') = ''
)
update public.best_pay_comparison_sessions s
set
  data = s.data
    || jsonb_build_object(
      'status', 'discarded',
      'discardedAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'updatedAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
  updated_at = now()
from ranked r
where s.id = r.id
  and r.rn > 1;

create unique index if not exists best_pay_one_active_advice_draft_per_lead
  on public.best_pay_comparison_sessions (lead_id)
  where lead_id is not null
    and offer_id is null
    and coalesce(data->>'status', '') not in ('discarded', 'offer_created')
    and coalesce(data->>'archivedAt', '') = ''
    and coalesce(data->'wizard'->>'wizardCompletedAt', '') = '';
