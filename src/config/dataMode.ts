export type DataMode = 'local' | 'supabase';

const FINAL_SUPABASE_REF = 'vohnqrftkuefkugabcob';

/**
 * Produktionsbuilds dürfen niemals in den Local-/Demo-Modus fallen.
 * Worker-Secrets ersetzen Vite-Buildvariablen nicht.
 */
export function getDataMode(): DataMode {
  const value = (import.meta.env.VITE_DATA_MODE as string | undefined)?.trim().toLowerCase();

  if (import.meta.env.PROD) {
    if (value !== 'supabase') {
      throw new Error(
        'Produktionsbuild erfordert VITE_DATA_MODE=supabase. Local-/Demo-Modus ist nicht erlaubt.',
      );
    }
    return 'supabase';
  }

  if (value === 'supabase') {
    return 'supabase';
  }
  return 'local';
}

export function isSupabaseDataMode(): boolean {
  return getDataMode() === 'supabase';
}

export function requireSupabaseEnv(): { url: string; publishableKey: string } {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
  const publishableKey =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? '';

  if (!url || !publishableKey) {
    throw new Error(
      'Supabase-Modus aktiv, aber VITE_SUPABASE_URL oder VITE_SUPABASE_PUBLISHABLE_KEY fehlt.',
    );
  }

  if (!url.includes(FINAL_SUPABASE_REF)) {
    throw new Error('Ungültige Supabase-URL: nur die finale Projektinstanz ist erlaubt.');
  }

  return { url, publishableKey };
}

/** Für Build-Zeit und Tests: Production muss Supabase-Env haben. */
export function assertProductionDataModeEnv(env: {
  PROD?: boolean | string;
  MODE?: string;
  VITE_DATA_MODE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}): void {
  const isProd =
    env.PROD === true ||
    env.PROD === 'true' ||
    env.MODE === 'production';

  if (!isProd) {
    return;
  }

  const mode = env.VITE_DATA_MODE?.trim().toLowerCase();
  if (mode !== 'supabase') {
    throw new Error(
      'Production erfordert VITE_DATA_MODE=supabase (fehlt oder ist local).',
    );
  }

  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  if (!url || !key) {
    throw new Error(
      'Production erfordert VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
  }
  if (!url.includes(FINAL_SUPABASE_REF)) {
    throw new Error('Production erlaubt nur die finale Supabase-Instanz.');
  }
}
