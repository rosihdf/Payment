import react from '@vitejs/plugin-react';
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // localStorage-basierte Domain-Tests teilen sonst Worker-Zustand und werden flaky.
    fileParallelism: false,
    maxWorkers: 1,
    // `e2e/*.spec.ts` sind Playwright-Tests (eigener Testrunner, `playwright.config.ts`) –
    // ohne Ausschluss versucht Vitest sie ebenfalls einzusammeln und schlägt fehl, weil
    // `test.describe()` dort aus `@playwright/test` statt aus Vitest stammt.
    // `*.remote.test.ts` benötigen Supabase/Credentials – siehe npm run test:remote.
    exclude: [...defaultExclude, 'e2e/**', '**/*.remote.test.ts'],
  },
});
