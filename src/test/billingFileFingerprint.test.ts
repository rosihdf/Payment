import { describe, expect, it } from 'vitest';
import { fingerprintBillingFileContent } from '../domain/billingImportEngine/billingFileFingerprint';

describe('billingFileFingerprint', () => {
  it('erzeugt identischen Fingerprint für identischen Inhalt', async () => {
    const content = new TextEncoder().encode('same-content').buffer;
    const left = await fingerprintBillingFileContent(content);
    const right = await fingerprintBillingFileContent(content);
    expect(left).toBe(right);
  });

  it('unterscheidet unterschiedlichen Inhalt bei gleichem Dateinamen', async () => {
    const left = await fingerprintBillingFileContent(new TextEncoder().encode('a').buffer);
    const right = await fingerprintBillingFileContent(new TextEncoder().encode('b').buffer);
    expect(left).not.toBe(right);
  });
});
