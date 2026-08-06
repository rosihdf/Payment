-- Kundensichtbarkeit ausschließlich über Betreuerzuweisung (assigned_sales_user_id).
-- Außendienst: kein Zugriff mehr über created_by_user_id.
-- UPDATE: Außendienst darf assigned_sales_user_id nicht ändern (WITH CHECK = auth.uid()).

create or replace function public.can_access_lead(p_lead_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.leads l
      where l.id = p_lead_id
        and l.assigned_sales_user_id = auth.uid()::text
    );
$$;

create or replace function public.can_access_offer(p_offer_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.offers o
      where o.id = p_offer_id
        and (
          (
            o.lead_id is not null
            and o.lead_id <> ''
            and public.can_access_lead(o.lead_id)
          )
          or (
            (o.lead_id is null or o.lead_id = '')
            and o.created_by_user_id = auth.uid()::text
          )
        )
    );
$$;

drop policy if exists leads_select_policy on public.leads;
create policy leads_select_policy
  on public.leads for select
  to authenticated
  using (
    public.is_admin()
    or assigned_sales_user_id = auth.uid()::text
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
  )
  with check (
    public.is_admin()
    or assigned_sales_user_id = auth.uid()::text
  );

revoke all on function public.can_access_lead(text) from public;
revoke all on function public.can_access_lead(text) from anon;
grant execute on function public.can_access_lead(text) to authenticated, service_role;

revoke all on function public.can_access_offer(text) from public;
revoke all on function public.can_access_offer(text) from anon;
grant execute on function public.can_access_offer(text) to authenticated, service_role;
