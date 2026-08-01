#!/usr/bin/env node
/**
 * Liest den Service-Role-Key via Supabase CLI und setzt ihn als Wrangler-Secret.
 * Gibt den Key niemals aus.
 */
import { spawnSync } from 'node:child_process';

const listed = spawnSync(
  'npx',
  ['supabase', 'projects', 'api-keys', '--project-ref', 'vohnqrftkuefkugabcob', '-o', 'json'],
  { encoding: 'utf8' },
);

if (listed.status !== 0) {
  console.error('Supabase API-Keys konnten nicht gelesen werden. Bitte lokal ausführen:');
  console.error('  npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY');
  process.exit(listed.status ?? 1);
}

let rows;
try {
  rows = JSON.parse(listed.stdout);
} catch {
  console.error('Ungültige API-Keys-Antwort.');
  process.exit(1);
}

const list = Array.isArray(rows) ? rows : [];
const service = list.find((entry) => {
  const name = String(entry.name ?? entry.type ?? '').toLowerCase();
  return name.includes('service');
});

const key = service?.api_key ?? service?.key ?? service?.secret;
if (!key || typeof key !== 'string') {
  console.error('Service-Role-Key nicht gefunden. Bitte manuell setzen:');
  console.error('  npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const put = spawnSync('npx', ['wrangler', 'secret', 'put', 'SUPABASE_SERVICE_ROLE_KEY'], {
  input: key,
  encoding: 'utf8',
});

if (put.status !== 0) {
  console.error(put.stderr || put.stdout || 'wrangler secret put fehlgeschlagen');
  process.exit(put.status ?? 1);
}

console.log('SUPABASE_SERVICE_ROLE_KEY als Worker-Secret gesetzt (Wert nicht ausgegeben).');
