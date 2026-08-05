import { describe, expect, it } from 'vitest';
import {
  CURRENT_PROVIDER_NONE,
  CURRENT_PROVIDER_OTHER,
  mapProviderNameToSelection,
  resolveCurrentProviderDisplayName,
} from '../domain/bestPayComparison/currentProviderCatalog';
import { normalizeProspectDraftProvider } from '../domain/bestPayComparison/salesWizard';

describe('Aktueller Anbieter Katalog', () => {
  it('mappt bekannte OCR-Namen', () => {
    expect(mapProviderNameToSelection('SumUp').code).toBe('SumUp');
    expect(mapProviderNameToSelection('paypal zettle').code).toBe('PayPal Zettle');
  });

  it('unbekannte Namen als Anderer Anbieter', () => {
    const mapped = mapProviderNameToSelection('Unbekannter Acquirer XY');
    expect(mapped.code).toBe(CURRENT_PROVIDER_OTHER);
    expect(mapped.other).toBe('Unbekannter Acquirer XY');
  });

  it('normalisiert Legacy-notes auf Provider-Auswahl', () => {
    const normalized = normalizeProspectDraftProvider({
      companyName: '',
      contactFirstName: '',
      contactLastName: '',
      phone: '',
      email: '',
      industry: '',
      notes: 'TeleCash',
      currentProviderCode: '',
      currentProviderOther: '',
    });
    expect(normalized.currentProviderCode).toBe('TeleCash');
  });

  it('formatiert Anzeigenamen', () => {
    expect(resolveCurrentProviderDisplayName(CURRENT_PROVIDER_NONE, '')).toBe('Noch kein Anbieter');
    expect(resolveCurrentProviderDisplayName(CURRENT_PROVIDER_OTHER, 'Foo')).toBe('Foo');
    expect(resolveCurrentProviderDisplayName('Nexi', '')).toBe('Nexi');
  });
});
