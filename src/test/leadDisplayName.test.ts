import { describe, expect, it } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import { resolveBestPayComparisonTitle } from '../domain/bestPayComparison/bestPayComparisonSummary';
import {
  enrichLeadWithDisplayName,
  getLeadDisplayName,
  getSessionCustomerDisplayName,
  isInternalLeadIdentifier,
  resolveStoredLeadLabel,
  UNNAMED_LEAD_DISPLAY_NAME,
} from '../domain/lead/getLeadDisplayName';
import { createTestLead } from './helpers/leadTestHelpers';

describe('getLeadDisplayName', () => {
  it('bevorzugt Firmenname', () => {
    expect(
      getLeadDisplayName({
        companyName: 'Café Nord GmbH',
        contactFirstName: 'Anna',
        contactLastName: 'Schmidt',
        city: 'Hamburg',
      }),
    ).toBe('Café Nord GmbH');
  });

  it('nutzt Ansprechpartner ohne Firma', () => {
    expect(
      getLeadDisplayName({
        companyName: '',
        contactFirstName: 'Anna',
        contactLastName: 'Schmidt',
        city: 'Hamburg',
      }),
    ).toBe('Anna Schmidt');
  });

  it('nutzt Ort ohne Firma und Ansprechpartner', () => {
    expect(
      getLeadDisplayName({
        companyName: '',
        contactFirstName: '',
        contactLastName: '',
        city: 'Hamburg',
      }),
    ).toBe('Hamburg');
  });

  it('nutzt Kundennummer als letzte sinnvolle Quelle', () => {
    expect(
      getLeadDisplayName({
        companyName: '',
        contactFirstName: '',
        contactLastName: '',
        city: '',
        customerNumber: 'KD-4711',
      }),
    ).toBe('KD-4711');
  });

  it('liefert Unbenannter Kunde für komplett leeren Lead', () => {
    expect(
      getLeadDisplayName({
        companyName: '',
        contactFirstName: '',
        contactLastName: '',
        city: '',
      }),
    ).toBe(UNNAMED_LEAD_DISPLAY_NAME);
  });

  it('filtert interne Lead-IDs aus sichtbaren Feldern', () => {
    const internalId = 'lead_e27ab486-f133-4cea-ab07-dddc4400155d';
    expect(isInternalLeadIdentifier(internalId)).toBe(true);
    expect(
      getLeadDisplayName({
        companyName: internalId,
        contactFirstName: '',
        contactLastName: '',
        city: '',
      }),
    ).toBe(UNNAMED_LEAD_DISPLAY_NAME);
  });

  it('reichert Lead mit displayName an', () => {
    const lead = createTestLead({
      companyName: '',
      contactFirstName: 'Max',
      contactLastName: 'Muster',
    });
    expect(enrichLeadWithDisplayName(lead).displayName).toBe('Max Muster');
  });
});

describe('resolveStoredLeadLabel', () => {
  it('ignoriert gespeicherte interne IDs und fällt auf gültige Werte zurück', () => {
    expect(
      resolveStoredLeadLabel(
        'lead_e27ab486-f133-4cea-ab07-dddc4400155d',
        'Café Test',
      ),
    ).toBe('Café Test');
  });
});

describe('getSessionCustomerDisplayName', () => {
  it('leitet Session-Anzeigenamen aus Prospect-Draft ab', () => {
    const session = createBestPayComparisonSession('user_001', {
      customerLabel: 'lead_e27ab486-f133-4cea-ab07-dddc4400155d',
    });
    session.wizard.prospectDraft = {
      ...session.wizard.prospectDraft,
      companyName: '',
      contactFirstName: 'Laura',
      contactLastName: 'Berger',
    };

    expect(getSessionCustomerDisplayName(session)).toBe('Laura Berger');
    expect(resolveBestPayComparisonTitle(session)).toBe('Laura Berger');
  });

  it('kennzeichnet anonyme Beratung ohne Prospect-Daten', () => {
    const session = createBestPayComparisonSession('user_001');
    expect(getSessionCustomerDisplayName(session)).toBe('Beratung ohne Kundenzuordnung');
  });
});
