#!/usr/bin/env node
/**
 * Authentifizierter Supabase-Browser-Abnahmelauf.
 * Erfordert SUPABASE_TEST_* in .env.local oder .env.supabase.acceptance.local (gitignored).
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const entries = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    entries[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return entries;
}

const env = {
  ...parseEnvFile(resolve(ROOT, '.env.local')),
  ...parseEnvFile(resolve(ROOT, '.env.supabase.acceptance.local')),
  ...parseEnvFile(resolve(homedir(), '.amrtech-payment-leads.acceptance.env')),
  ...process.env,
};

const required = [
  'SUPABASE_TEST_EMAIL',
  'SUPABASE_TEST_PASSWORD',
  'SUPABASE_TEST_FIELD_EMAIL',
  'SUPABASE_TEST_FIELD_PASSWORD',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
];

const missing = required.filter((key) => !env[key]?.trim());
if (missing.length > 0) {
  console.error(`Abbruch – fehlende Pflichtzugänge: ${missing.join(', ')}`);
  process.exit(1);
}

for (const key of required) {
  console.log(`${key}: vorhanden`);
}

const verify = spawnSync('npx', ['tsx', 'scripts/verify-supabase-acceptance-credentials.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, ...env },
});
if (verify.status !== 0) {
  process.exit(verify.status ?? 1);
}

const result = spawnSync(
  'npx',
  ['playwright', 'test', '--config=playwright.supabase.config.ts', '--reporter=line'],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env, VITE_DATA_MODE: 'supabase' },
  },
);

process.exit(result.status ?? 1);
