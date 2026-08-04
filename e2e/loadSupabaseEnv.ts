import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }
  const entries: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

/** Lädt .env.local und optional .env.supabase.acceptance.local (gitignored). */
export function loadSupabaseEnv(): Record<string, string> {
  const merged = {
    ...parseEnvFile(resolve(ROOT, '.env.local')),
    ...parseEnvFile(resolve(ROOT, '.env.supabase.acceptance.local')),
    ...parseEnvFile(resolve(process.env.HOME ?? '', '.amrtech-payment-leads.acceptance.env')),
    ...process.env,
  } as Record<string, string>;
  return merged;
}

export function requireSupabaseCredentials(env: Record<string, string>): {
  adminEmail: string;
  adminPassword: string;
  fieldEmail: string;
  fieldPassword: string;
} {
  const adminEmail = env.SUPABASE_TEST_EMAIL?.trim();
  const adminPassword = env.SUPABASE_TEST_PASSWORD?.trim();
  const fieldEmail = env.SUPABASE_TEST_FIELD_EMAIL?.trim();
  const fieldPassword = env.SUPABASE_TEST_FIELD_PASSWORD?.trim();

  const missing: string[] = [];
  if (!adminEmail) missing.push('SUPABASE_TEST_EMAIL');
  if (!adminPassword) missing.push('SUPABASE_TEST_PASSWORD');
  if (!fieldEmail) missing.push('SUPABASE_TEST_FIELD_EMAIL');
  if (!fieldPassword) missing.push('SUPABASE_TEST_FIELD_PASSWORD');

  if (missing.length > 0) {
    throw new Error(`Fehlende Pflichtzugänge: ${missing.join(', ')}`);
  }

  return {
    adminEmail: adminEmail!,
    adminPassword: adminPassword!,
    fieldEmail: fieldEmail!,
    fieldPassword: fieldPassword!,
  };
}

/** Prüft Admin- und Außendienst-Login gegen Supabase Auth (ohne Secrets zu loggen). */
export async function verifySupabaseCredentials(env: Record<string, string>): Promise<void> {
  const credentials = requireSupabaseCredentials(env);
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL oder VITE_SUPABASE_PUBLISHABLE_KEY fehlt');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key);

  for (const [label, email, password] of [
    ['Admin', credentials.adminEmail, credentials.adminPassword],
    ['Außendienst', credentials.fieldEmail, credentials.fieldPassword],
  ] as const) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(
        `${label}-Login fehlgeschlagen für ${email}: ${error.message}. Bitte Zugangsdaten in ~/.amrtech-payment-leads.acceptance.env prüfen.`,
      );
    }
    await client.auth.signOut();
  }
}
