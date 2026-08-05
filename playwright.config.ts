import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-Konfiguration für die Vite/React-App.
 *
 * Läuft bewusst im Vite-Dev-Server (nicht `vite build`), weil der lokale
 * Demo-/Persistenzmodus (`RoleSwitcher`, `AppRuntimeConfig.demoMode`) nur
 * aktiv ist, wenn `import.meta.env.PROD === false` ist – siehe
 * `src/config/appRuntimeConfig.ts`. Ohne `VITE_DATA_MODE=supabase` läuft die
 * App automatisch im lokalen Demo-Modus mit `localStorage`-Persistenz
 * (siehe `src/config/dataMode.ts`) – keine Produktions-Secrets nötig.
 */
const PORT = 4319;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/supabase-core-acceptance.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // `--host 0.0.0.0` statt Standard-Loopback: in manchen Sandbox-/Container-
    // Netzwerken ist 127.0.0.1 sonst vom Testrunner aus nicht erreichbar.
    command: `npx vite --port ${PORT} --strictPort --host 0.0.0.0`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      // Produktstandard: OCR aktiv. Explizit false schaltet UI und Specs ab.
      VITE_BILLING_OCR_IMPORT_ENABLED: process.env.VITE_BILLING_OCR_IMPORT_ENABLED ?? 'true',
      // Demo-OCR nur wenn ausdrücklich gesetzt (sonst realer Tesseract-Pfad).
      ...(process.env.VITE_BILLING_DEMO_OCR
        ? { VITE_BILLING_DEMO_OCR: process.env.VITE_BILLING_DEMO_OCR }
        : {}),
    },
  },
});
