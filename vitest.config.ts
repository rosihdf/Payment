import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

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
  },
});
