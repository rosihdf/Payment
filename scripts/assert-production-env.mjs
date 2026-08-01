#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FINAL_REF = 'vohnqrftkuefkugabcob';

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }
  const values = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const root = process.cwd();
// Vite-Priorität für production: .env.production.local > .env.local > process.env
const merged = {
  ...loadEnvFile(resolve(root, '.env')),
  ...loadEnvFile(resolve(root, '.env.local')),
  ...loadEnvFile(resolve(root, '.env.production')),
  ...loadEnvFile(resolve(root, '.env.production.local')),
  ...process.env,
};

const mode = (merged.VITE_DATA_MODE ?? '').trim().toLowerCase();
const url = (merged.VITE_SUPABASE_URL ?? '').trim();
const key = (merged.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

if (mode !== 'supabase') {
  console.error(
    'assert-production-env: VITE_DATA_MODE muss "supabase" sein (aktuell: ' +
      JSON.stringify(merged.VITE_DATA_MODE ?? '') +
      '). Worker-Secrets ersetzen Vite-Buildvariablen nicht.',
  );
  process.exit(1);
}

if (!url || !key) {
  console.error(
    'assert-production-env: VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY sind erforderlich.',
  );
  process.exit(1);
}

if (!url.includes(FINAL_REF)) {
  console.error('assert-production-env: Ungültige Supabase-URL – nur die finale Instanz ist erlaubt.');
  process.exit(1);
}

if (/sb_secret_|service_role|postgres:\/\//i.test(key) || /sb_secret_/i.test(url)) {
  console.error('assert-production-env: Secrets/DB-Passwörter dürfen nicht als Publishable Key verwendet werden.');
  process.exit(1);
}

console.log('assert-production-env: OK (VITE_DATA_MODE=supabase, finale Instanz).');
