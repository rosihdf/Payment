import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdviceBillingOcrImportEnabled } from '../config/billingOcrFeature';

describe('billingOcrFeature', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ist standardmäßig aktiv', () => {
    vi.stubEnv('VITE_BILLING_OCR_IMPORT_ENABLED', '');
    expect(isAdviceBillingOcrImportEnabled()).toBe(true);
  });

  it('bleibt bei explizitem true aktiv', () => {
    vi.stubEnv('VITE_BILLING_OCR_IMPORT_ENABLED', 'true');
    expect(isAdviceBillingOcrImportEnabled()).toBe(true);
  });

  it('wird nur bei explizitem false deaktiviert', () => {
    vi.stubEnv('VITE_BILLING_OCR_IMPORT_ENABLED', 'false');
    expect(isAdviceBillingOcrImportEnabled()).toBe(false);
  });
});
