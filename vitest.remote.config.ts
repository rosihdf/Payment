import base from './vitest.config';

/** Nur Remote-/Supabase-Integrationstests – nicht Teil der lokalen Unit-Baseline. */
export default {
  ...base,
  test: {
    ...base.test,
    include: ['src/**/*.remote.test.ts'],
    exclude: ['e2e/**'],
  },
};
