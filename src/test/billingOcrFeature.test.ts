import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdviceBillingOcrImportEnabled } from '../config/billingOcrFeature';

describe('billingOcrFeature', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ist standardmäßig deaktiviert', () => {
    vi.stubEnv('VITE_BILLING_OCR_IMPORT_ENABLED', '');
    expect(isAdviceBillingOcrImportEnabled()).toBe(false);
  });

  it('wird nur bei explizitem true aktiv', () => {
    vi.stubEnv('VITE_BILLING_OCR_IMPORT_ENABLED', 'true');
    expect(isAdviceBillingOcrImportEnabled()).toBe(true);
  });
});
