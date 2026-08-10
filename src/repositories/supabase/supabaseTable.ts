import { getSupabaseClient } from '../../lib/supabaseClient';

export interface JsonTableRow {
  id: string;
  data: unknown;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export async function sbSelectAll(table: string): Promise<JsonTableRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from(table).select('*');
  if (error) {
    throw new Error(`${table} laden fehlgeschlagen: ${error.message}`);
  }
  return (data ?? []) as JsonTableRow[];
}

export async function sbSelectById(table: string, id: string): Promise<JsonTableRow | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
  if (error) {
    throw new Error(`${table} laden fehlgeschlagen: ${error.message}`);
  }
  return data as JsonTableRow | null;
}

export async function sbSelectWhere(
  table: string,
  column: string,
  value: string,
  columns = '*',
): Promise<JsonTableRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from(table).select(columns).eq(column, value);
  if (error) {
    throw new Error(`${table} laden fehlgeschlagen: ${error.message}`);
  }
  return (data ?? []) as unknown as JsonTableRow[];
}

export async function sbSelectWhereIn(
  table: string,
  column: string,
  values: string[],
): Promise<JsonTableRow[]> {
  if (values.length === 0) {
    return [];
  }
  const client = getSupabaseClient();
  const { data, error } = await client.from(table).select('*').in(column, values);
  if (error) {
    throw new Error(`${table} laden fehlgeschlagen: ${error.message}`);
  }
  return (data ?? []) as JsonTableRow[];
}

export async function sbCountWhere(
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const client = getSupabaseClient();
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value);
  if (error) {
    throw new Error(`${table} zählen fehlgeschlagen: ${error.message}`);
  }
  return count ?? 0;
}

export async function sbInsertWithoutReturn(
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from(table).insert(row);
  if (error) {
    throw new Error(`${table} anlegen fehlgeschlagen: ${error.message}`);
  }
}

export async function sbInsert(table: string, row: Record<string, unknown>): Promise<JsonTableRow> {
  const client = getSupabaseClient();
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) {
    throw new Error(`${table} anlegen fehlgeschlagen: ${error.message}`);
  }
  return data as JsonTableRow;
}

export async function sbUpdateWithoutReturn(
  table: string,
  id: string,
  row: Record<string, unknown>,
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from(table).update(row).eq('id', id);
  if (error) {
    throw new Error(`${table} aktualisieren fehlgeschlagen: ${error.message}`);
  }
}

export async function sbUpdate(
  table: string,
  id: string,
  row: Record<string, unknown>,
): Promise<JsonTableRow> {
  const client = getSupabaseClient();
  const { data, error } = await client.from(table).update(row).eq('id', id).select('*').single();
  if (error) {
    throw new Error(`${table} aktualisieren fehlgeschlagen: ${error.message}`);
  }
  return data as JsonTableRow;
}

export async function sbDelete(table: string, id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) {
    throw new Error(`${table} löschen fehlgeschlagen: ${error.message}`);
  }
}

export async function sbUpsertMany(table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  const client = getSupabaseClient();
  const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
  if (error) {
    throw new Error(`${table} upsert fehlgeschlagen: ${error.message}`);
  }
}

export function rowData<T>(row: JsonTableRow, fallback: T): T {
  if (row.data && typeof row.data === 'object' && !Array.isArray(row.data)) {
    return { ...fallback, ...(row.data as Record<string, unknown>) } as T;
  }
  return fallback;
}
