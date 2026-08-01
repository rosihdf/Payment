import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseEnv } from '../config/dataMode';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const { url, publishableKey } = requireSupabaseEnv();
  client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/** Test-only reset. */
export function resetSupabaseClientForTests(): void {
  client = null;
}
