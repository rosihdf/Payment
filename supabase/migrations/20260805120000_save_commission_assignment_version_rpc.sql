-- Atomare Speicherung von Mitarbeiter-Provisionsvereinbarungen (eine Transaktion).
-- Ersetzt den browserseitigen Mehrfach-Write (Version + Assignment + Audit).

create or replace function public.save_commission_assignment_version(
  p_sales_representative_id text,
  p_commission_plan_version_id text,
  p_valid_from text,
  p_valid_until text default null,
  p_rule_overrides jsonb default '[]'::jsonb,
  p_change_note text default '',
  p_expected_current_version_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id text;
  v_actor_display_name text;
  v_now timestamptz := clock_timestamp();
  v_now_iso text;
  v_assignment public.commission_assignments%rowtype;
  v_current_version public.commission_assignment_versions%rowtype;
  v_normalized jsonb := '[]'::jsonb;
  v_override jsonb;
  v_rule_id text;
  v_share numeric;
  v_fixed bigint;
  v_percent bigint;
  v_disabled boolean;
  v_rule_exists boolean;
  v_plan_exists boolean;
  v_profile_exists boolean;
  v_next_version_number integer;
  v_version_id text;
  v_assignment_id text;
  v_assignment_data jsonb;
  v_version_data jsonb;
  v_audit_id text;
  v_current_overrides jsonb;
  v_is_default boolean;
  v_overlap_exists boolean;
  v_assignment_found boolean := false;
  v_valid_until text;
  v_change_note text;
begin
  v_now_iso := to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_valid_until := nullif(btrim(coalesce(p_valid_until, '')), '');
  v_change_note := coalesce(p_change_note, '');

  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  v_actor_id := auth.uid()::text;

  if not public.is_active_commission_user() or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select p.display_name
    into v_actor_display_name
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;

  v_actor_display_name := coalesce(nullif(btrim(v_actor_display_name), ''), v_actor_id);

  if p_sales_representative_id is null or btrim(p_sales_representative_id) = '' then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.user_id::text = p_sales_representative_id
      and p.role = 'field_service'
  )
  into v_profile_exists;

  if not v_profile_exists then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  if p_commission_plan_version_id is null or btrim(p_commission_plan_version_id) = '' then
    return jsonb_build_object('ok', false, 'error', 'rule_not_found');
  end if;

  select exists (
    select 1
    from public.commission_plan_versions pv
    where pv.id = p_commission_plan_version_id
  )
  into v_plan_exists;

  if not v_plan_exists then
    return jsonb_build_object('ok', false, 'error', 'rule_not_found');
  end if;

  if p_valid_from is null
     or p_valid_from !~ '^\d{4}-\d{2}-\d{2}$'
     or (v_valid_until is not null and v_valid_until !~ '^\d{4}-\d{2}-\d{2}$')
     or (v_valid_until is not null and v_valid_until < p_valid_from)
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_validity');
  end if;

  if p_rule_overrides is null or jsonb_typeof(p_rule_overrides) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'share_range');
  end if;

  for v_override in
    select value
    from jsonb_array_elements(p_rule_overrides) as t(value)
  loop
    v_rule_id := nullif(btrim(coalesce(v_override->>'ruleId', '')), '');
    if v_rule_id is null then
      return jsonb_build_object('ok', false, 'error', 'rule_not_found');
    end if;

    select exists (
      select 1
      from public.commission_rules r
      where r.id = v_rule_id
        and coalesce(r.data->>'commissionPlanVersionId', '') = p_commission_plan_version_id
    )
    into v_rule_exists;

    if not v_rule_exists then
      return jsonb_build_object('ok', false, 'error', 'rule_not_found');
    end if;

    v_disabled := coalesce((v_override->>'disabled')::boolean, false);
    v_share := null;
    v_fixed := null;
    v_percent := null;

    if v_override ? 'sharePercent'
       and v_override->>'sharePercent' is not null
       and v_override->>'sharePercent' <> 'null'
    then
      begin
        v_share := (v_override->>'sharePercent')::numeric;
      exception
        when others then
          return jsonb_build_object('ok', false, 'error', 'share_range');
      end;
      if v_share is null
         or v_share <> trunc(v_share)
         or v_share < 0
         or v_share > 100
      then
        return jsonb_build_object('ok', false, 'error', 'share_range');
      end if;
    end if;

    if v_override ? 'fixedAmountCents'
       and v_override->>'fixedAmountCents' is not null
       and v_override->>'fixedAmountCents' <> 'null'
       and v_share is null
    then
      begin
        v_fixed := (v_override->>'fixedAmountCents')::bigint;
      exception
        when others then
          return jsonb_build_object('ok', false, 'error', 'invalid_amount');
      end;
      if v_fixed is null or v_fixed < 0 then
        return jsonb_build_object('ok', false, 'error', 'invalid_amount');
      end if;
    end if;

    if v_override ? 'percentTenthsOfBasisPoint'
       and v_override->>'percentTenthsOfBasisPoint' is not null
       and v_override->>'percentTenthsOfBasisPoint' <> 'null'
    then
      begin
        v_percent := (v_override->>'percentTenthsOfBasisPoint')::bigint;
      exception
        when others then
          return jsonb_build_object('ok', false, 'error', 'invalid_amount');
      end;
    end if;

    if v_disabled then
      v_normalized := v_normalized || jsonb_build_array(
        jsonb_build_object(
          'ruleId', v_rule_id,
          'sharePercent', null,
          'fixedAmountCents', null,
          'percentTenthsOfBasisPoint', v_percent,
          'disabled', true
        )
      );
    elsif v_share is not null then
      v_normalized := v_normalized || jsonb_build_array(
        jsonb_build_object(
          'ruleId', v_rule_id,
          'sharePercent', v_share::int,
          'fixedAmountCents', null,
          'percentTenthsOfBasisPoint', null
        )
      );
    elsif v_fixed is not null then
      v_normalized := v_normalized || jsonb_build_array(
        jsonb_build_object(
          'ruleId', v_rule_id,
          'sharePercent', null,
          'fixedAmountCents', v_fixed,
          'percentTenthsOfBasisPoint', null
        )
      );
    else
      v_normalized := v_normalized || jsonb_build_array(
        jsonb_build_object(
          'ruleId', v_rule_id,
          'sharePercent', 100,
          'fixedAmountCents', null,
          'percentTenthsOfBasisPoint', v_percent
        )
      );
    end if;
  end loop;

  -- Deterministische Reihenfolge für Idempotenzvergleiche
  select coalesce(jsonb_agg(elem order by elem->>'ruleId'), '[]'::jsonb)
    into v_normalized
  from jsonb_array_elements(v_normalized) as t(elem);

  -- Aktive Primärvereinbarung sperren
  select *
    into v_assignment
  from public.commission_assignments a
  where a.sales_representative_id = p_sales_representative_id
    and coalesce(a.data->>'status', '') = 'active'
    and coalesce((a.data->>'isPrimary')::boolean, false) = true
  order by a.updated_at desc
  limit 1
  for update;

  v_assignment_found := found;

  if v_assignment_found then
    if p_expected_current_version_id is not null
       and btrim(p_expected_current_version_id) <> ''
       and coalesce(v_assignment.data->>'currentVersionId', '') is distinct from p_expected_current_version_id
    then
      return jsonb_build_object('ok', false, 'error', 'version_conflict');
    end if;

    if v_assignment.data->>'currentVersionId' is not null then
      select *
        into v_current_version
      from public.commission_assignment_versions v
      where v.id = v_assignment.data->>'currentVersionId'
      for update;
    end if;
  elsif p_expected_current_version_id is not null
        and btrim(p_expected_current_version_id) <> ''
  then
    return jsonb_build_object('ok', false, 'error', 'version_conflict');
  end if;

  -- Overlap mit anderen aktiven Primärzuordnungen
  select exists (
    select 1
    from public.commission_assignments other
    where other.sales_representative_id = p_sales_representative_id
      and coalesce(other.data->>'status', '') = 'active'
      and coalesce((other.data->>'isPrimary')::boolean, false) = true
      and (not v_assignment_found or other.id <> v_assignment.id)
      and (other.data->>'validFrom')::date <= coalesce(v_valid_until::date, '9999-12-31'::date)
      and p_valid_from::date <= coalesce((other.data->>'validUntil')::date, '9999-12-31'::date)
  )
  into v_overlap_exists;

  if v_overlap_exists then
    return jsonb_build_object('ok', false, 'error', 'overlap');
  end if;

  if v_assignment_found and v_current_version.id is not null then
    select coalesce(jsonb_agg(elem order by elem->>'ruleId'), '[]'::jsonb)
      into v_current_overrides
    from jsonb_array_elements(coalesce(v_current_version.data->'ruleOverrides', '[]'::jsonb)) as t(elem);

    if coalesce(v_assignment.data->>'commissionPlanVersionId', '') = p_commission_plan_version_id
       and coalesce(v_assignment.data->>'validFrom', '') = p_valid_from
       and coalesce(v_assignment.data->>'validUntil', '') is not distinct from coalesce(v_valid_until, '')
       and v_current_overrides = v_normalized
    then
      return jsonb_build_object(
        'ok', true,
        'changed', false,
        'unchanged', true,
        'assignmentId', v_assignment.id,
        'currentVersionId', v_current_version.id,
        'versionNumber', coalesce((v_current_version.data->>'versionNumber')::int, 0),
        'commissionPlanVersionId', p_commission_plan_version_id,
        'validFrom', p_valid_from,
        'validUntil', to_jsonb(v_valid_until),
        'ruleOverrides', v_normalized,
        'isDefault', not exists (
          select 1
          from jsonb_array_elements(v_normalized) as t(elem)
          where coalesce((elem->>'disabled')::boolean, false) = true
             or (
               elem ? 'sharePercent'
               and elem->>'sharePercent' is not null
               and elem->>'sharePercent' <> 'null'
               and (elem->>'sharePercent')::int <> 100
             )
             or (
               (elem->>'sharePercent') is null
               and elem ? 'fixedAmountCents'
               and elem->>'fixedAmountCents' is not null
               and elem->>'fixedAmountCents' <> 'null'
             )
             or (
               elem ? 'percentTenthsOfBasisPoint'
               and elem->>'percentTenthsOfBasisPoint' is not null
               and elem->>'percentTenthsOfBasisPoint' <> 'null'
             )
        ),
        'assignment', v_assignment.data
      );
    end if;
  end if;

  if v_assignment_found then
    v_assignment_id := v_assignment.id;
    select coalesce(max(coalesce((v.data->>'versionNumber')::int, 0)), 0) + 1
      into v_next_version_number
    from public.commission_assignment_versions v
    where v.assignment_id = v_assignment_id;
  else
    v_assignment_id := 'commission_assignment_' || gen_random_uuid()::text;
    v_next_version_number := 1;
  end if;

  v_version_id := 'commission_assignment_version_' || gen_random_uuid()::text;

  v_version_data := jsonb_build_object(
    'id', v_version_id,
    'assignmentId', v_assignment_id,
    'salesRepresentativeId', p_sales_representative_id,
    'versionNumber', v_next_version_number,
    'commissionPlanVersionId', p_commission_plan_version_id,
    'validFrom', p_valid_from,
    'validUntil', to_jsonb(v_valid_until),
    'ruleOverrides', v_normalized,
    'changeNote', v_change_note,
    'createdByUserId', v_actor_id,
    'createdAt', v_now_iso
  );

  insert into public.commission_assignment_versions (
    id,
    assignment_id,
    sales_representative_id,
    data,
    created_at
  )
  values (
    v_version_id,
    v_assignment_id,
    p_sales_representative_id,
    v_version_data,
    v_now
  );

  if v_assignment_found then
    v_assignment_data := v_assignment.data
      || jsonb_build_object(
        'commissionPlanVersionId', p_commission_plan_version_id,
        'currentVersionId', v_version_id,
        'validFrom', p_valid_from,
        'validUntil', to_jsonb(v_valid_until),
        'reason', v_change_note,
        'updatedAt', v_now_iso
      );

    update public.commission_assignments
    set
      sales_representative_id = p_sales_representative_id,
      data = v_assignment_data,
      updated_at = v_now
    where id = v_assignment_id;
  else
    v_assignment_data := jsonb_build_object(
      'id', v_assignment_id,
      'salesRepresentativeId', p_sales_representative_id,
      'commissionPlanVersionId', p_commission_plan_version_id,
      'currentVersionId', v_version_id,
      'validFrom', p_valid_from,
      'validUntil', to_jsonb(v_valid_until),
      'isPrimary', true,
      'status', 'active',
      'reason', v_change_note,
      'createdByUserId', v_actor_id,
      'approvedByUserId', v_actor_id,
      'createdAt', v_now_iso,
      'updatedAt', v_now_iso
    );

    insert into public.commission_assignments (
      id,
      sales_representative_id,
      data,
      created_at,
      updated_at
    )
    values (
      v_assignment_id,
      p_sales_representative_id,
      v_assignment_data,
      v_now,
      v_now
    );
  end if;

  v_is_default := not exists (
    select 1
    from jsonb_array_elements(v_normalized) as t(elem)
    where coalesce((elem->>'disabled')::boolean, false) = true
       or (
         elem ? 'sharePercent'
         and elem->>'sharePercent' is not null
         and elem->>'sharePercent' <> 'null'
         and (elem->>'sharePercent')::int <> 100
       )
       or (
         (elem->>'sharePercent') is null
         and elem ? 'fixedAmountCents'
         and elem->>'fixedAmountCents' is not null
         and elem->>'fixedAmountCents' <> 'null'
       )
       or (
         elem ? 'percentTenthsOfBasisPoint'
         and elem->>'percentTenthsOfBasisPoint' is not null
         and elem->>'percentTenthsOfBasisPoint' <> 'null'
       )
  );

  v_audit_id := 'audit_' || gen_random_uuid()::text;
  insert into public.audit_entries (
    id,
    user_id,
    entity_type,
    entity_id,
    data,
    created_at
  )
  values (
    v_audit_id,
    v_actor_id,
    'commission_plan',
    v_assignment_id,
    jsonb_build_object(
      'id', v_audit_id,
      'schemaVersion', 1,
      'timestamp', v_now_iso,
      'userId', v_actor_id,
      'userDisplayName', v_actor_display_name,
      'action', 'commission_updated',
      'entityType', 'commission_plan',
      'entityId', v_assignment_id,
      'entityVersion', v_version_id,
      'summary', 'Provisionszuordnung für ' || p_sales_representative_id || ' gespeichert',
      'changes', '[]'::jsonb,
      'source', 'admin'
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'changed', true,
    'unchanged', false,
    'assignmentId', v_assignment_id,
    'currentVersionId', v_version_id,
    'versionNumber', v_next_version_number,
    'commissionPlanVersionId', p_commission_plan_version_id,
    'validFrom', p_valid_from,
    'validUntil', to_jsonb(v_valid_until),
    'ruleOverrides', v_normalized,
    'isDefault', v_is_default,
    'assignment', v_assignment_data
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'database_error'
    );
end;
$$;

revoke all on function public.save_commission_assignment_version(
  text, text, text, text, jsonb, text, text
) from public;

revoke all on function public.save_commission_assignment_version(
  text, text, text, text, jsonb, text, text
) from anon;

grant execute on function public.save_commission_assignment_version(
  text, text, text, text, jsonb, text, text
) to authenticated, service_role;
