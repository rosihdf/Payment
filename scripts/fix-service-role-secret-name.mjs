#!/usr/bin/env node
/**
 * Korrigiert häufigen Wrangler-Fehler: Service-Role-Key als Secret-Name statt SUPABASE_SERVICE_ROLE_KEY.
 * Gibt den Key niemals aus.
 */
import { spawnSync } from 'node:child_process';

function run(args, input) {
  return spawnSync('npx', args, {
    encoding: 'utf8',
    input,
  });
}

const listed = run(['wrangler', 'secret', 'list']);
if (listed.status !== 0) {
  console.error(listed.stderr || listed.stdout || 'wrangler secret list fehlgeschlagen');
  process.exit(listed.status ?? 1);
}

let secrets;
try {
  secrets = JSON.parse(listed.stdout);
} catch {
  console.error('Ungültige wrangler secret list Antwort.');
  process.exit(1);
}

const hasCorrect = secrets.some((entry) => entry.name === 'SUPABASE_SERVICE_ROLE_KEY');
if (hasCorrect) {
  console.log('SUPABASE_SERVICE_ROLE_KEY ist bereits korrekt gesetzt.');
  process.exit(0);
}

const misnamed = secrets.find(
  (entry) =>
    entry.type === 'secret_text' &&
    typeof entry.name === 'string' &&
    entry.name.startsWith('eyJ') &&
    entry.name.includes('.'),
);

if (!misnamed) {
  console.error(
    'Kein falsch benanntes Service-Role-Secret gefunden. Bitte manuell setzen:',
  );
  console.error('  npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

// Typischer Fehler: der JWT wurde als Secret-Name statt als Wert unter SUPABASE_SERVICE_ROLE_KEY gesetzt.
const put = run(['wrangler', 'secret', 'put', 'SUPABASE_SERVICE_ROLE_KEY'], misnamed.name);
if (put.status !== 0) {
  console.error(put.stderr || put.stdout || 'wrangler secret put fehlgeschlagen');
  process.exit(put.status ?? 1);
}

const deleted = run(['wrangler', 'secret', 'delete', misnamed.name]);
if (deleted.status !== 0) {
  console.warn(
    'SUPABASE_SERVICE_ROLE_KEY gesetzt, aber falsch benanntes Secret konnte nicht entfernt werden.',
  );
  console.warn(deleted.stderr || deleted.stdout || '');
  process.exit(0);
}

console.log(
  'SUPABASE_SERVICE_ROLE_KEY korrigiert (falsch benanntes Secret entfernt, Wert nicht ausgegeben).',
);
