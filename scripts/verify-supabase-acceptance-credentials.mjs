#!/usr/bin/env node
import { loadSupabaseEnv, verifySupabaseCredentials } from '../e2e/loadSupabaseEnv.ts';

try {
  await verifySupabaseCredentials(loadSupabaseEnv());
  console.log('Supabase-Testzugänge: Admin und Außendienst login ok');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
