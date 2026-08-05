import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const PORT = 4320;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ROOT = resolve(import.meta.dirname);

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const entries: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    entries[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return entries;
}

const fileEnv = {
  ...parseEnvFile(resolve(ROOT, '.env.local')),
  ...parseEnvFile(resolve(ROOT, '.env.supabase.acceptance.local')),
  ...parseEnvFile(resolve(homedir(), '.amrtech-payment-leads.acceptance.env')),
};

export default defineConfig({
  testDir: './e2e',
  testMatch: 'supabase-core-acceptance.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-supabase' }]],
  timeout: 360_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 0.0.0.0`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 90_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      ...fileEnv,
      VITE_DATA_MODE: 'supabase',
    },
  },
});
