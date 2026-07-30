import { describe, expect, it } from 'vitest';
import {
  BILLING_FILE_LIMITS,
  validateBillingFile,
} from '../domain/billingImportEngine/billingFileValidation';

describe('billingFileValidation', () => {
  it('akzeptiert gültiges PDF', () => {
    const result = validateBillingFile({
      name: 'abrechnung.pdf',
      type: 'application/pdf',
      size: 1024,
    });
    expect(result.ok).toBe(true);
  });

  it('lehnt leere Datei ab', () => {
    const result = validateBillingFile({ name: 'leer.pdf', type: 'application/pdf', size: 0 });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('BILLING_FILE_EMPTY');
  });

  it('lehnt unbekannten MIME-Typ ab', () => {
    const result = validateBillingFile({ name: 'datei.exe', type: 'application/x-msdownload', size: 100 });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('BILLING_FILE_TYPE_UNSUPPORTED');
  });

  it('lehnt zu große Datei ab', () => {
    const result = validateBillingFile({
      name: 'gross.pdf',
      type: 'application/pdf',
      size: BILLING_FILE_LIMITS.maxFileSizeBytes + 1,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('BILLING_FILE_TOO_LARGE');
  });
});
