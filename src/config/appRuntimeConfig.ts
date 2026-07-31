export type AppEnvironment = 'development' | 'production';
export type PersistenceMode = 'local';
export type AuthMode = 'demo' | 'future_remote';
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
  const demoMode = environment === 'development';

  return {
    ...DEFAULT_APP_RUNTIME_CONFIG,
    environment,
    demoMode,
    authMode: demoMode ? 'demo' : 'future_remote',
  };
}

export function validateAppRuntimeConfig(config: AppRuntimeConfig): string[] {
  const errors: string[] = [];

  if (config.environment === 'production' && config.demoMode) {
    errors.push('Produktionsmodus darf nicht im Demo-Modus starten.');
  }

  if (config.persistenceMode !== 'local') {
    errors.push('Nur lokaler Persistenzmodus ist implementiert.');
  }

  if (config.environment === 'production' && config.authMode === 'demo') {
    errors.push('Produktionsmodus erfordert zukünftige Auth-Anbindung.');
  }

  return errors;
}
