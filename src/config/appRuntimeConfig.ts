import { getDataMode, isSupabaseDataMode } from './dataMode';

export type AppEnvironment = 'development' | 'production';
export type PersistenceMode = 'local' | 'supabase';
export type AuthMode = 'demo' | 'supabase';
export type DiagnosticMode = 'standard' | 'verbose';

export interface AppRuntimeConfig {
  environment: AppEnvironment;
  appVersion: string;
  persistenceMode: PersistenceMode;
  authMode: AuthMode;
  demoMode: boolean;
  ocrEnabled: boolean;
  pdfEnabled: boolean;
  diagnosticMode: DiagnosticMode;
  remoteApiBaseUrl: string | null;
}

export const DEFAULT_APP_RUNTIME_CONFIG: AppRuntimeConfig = {
  environment: import.meta.env.PROD ? 'production' : 'development',
  appVersion: '0.1.0',
  persistenceMode: 'local',
  authMode: 'demo',
  demoMode: !import.meta.env.PROD,
  ocrEnabled: true,
  pdfEnabled: true,
  diagnosticMode: 'standard',
  remoteApiBaseUrl: null,
};

export function loadAppRuntimeConfig(): AppRuntimeConfig {
  const environment = import.meta.env.PROD ? 'production' : 'development';
  const supabaseMode = isSupabaseDataMode();
  const demoMode = environment === 'development' && !supabaseMode;

  return {
    ...DEFAULT_APP_RUNTIME_CONFIG,
    environment,
    persistenceMode: getDataMode(),
    demoMode,
    authMode: supabaseMode ? 'supabase' : demoMode ? 'demo' : 'supabase',
  };
}

export function validateAppRuntimeConfig(config: AppRuntimeConfig): string[] {
  const errors: string[] = [];

  if (config.environment === 'production' && config.demoMode) {
    errors.push('Produktionsmodus darf nicht im Demo-Modus starten.');
  }

  if (config.persistenceMode !== 'local' && config.persistenceMode !== 'supabase') {
    errors.push('Ungültiger Persistenzmodus.');
  }

  if (config.persistenceMode === 'supabase' && config.authMode !== 'supabase') {
    errors.push('Supabase-Persistenz erfordert Supabase-Auth.');
  }

  if (config.environment === 'production' && config.authMode === 'demo') {
    errors.push('Produktionsmodus erfordert Supabase-Auth.');
  }

  if (config.environment === 'production' && config.persistenceMode !== 'supabase') {
    errors.push('Produktionsmodus erfordert VITE_DATA_MODE=supabase.');
  }

  return errors;
}
