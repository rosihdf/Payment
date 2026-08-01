import { describe, expect, it } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import { formatBestPayComparisonFallbackTitle } from '../domain/bestPayComparison/bestPayComparisonSummary';
import {
  canDiscardEmptyAdviceSession,
  isEmptyAdviceSession,
} from '../domain/bestPayComparison/isEmptyAdviceSession';
import { DEFAULT_SALES_WIZARD_STATE } from '../domain/bestPayComparison/salesWizard';

describe('isEmptyAdviceSession', () => {
  it('erkennt technische Defaults als leer', () => {
    const session = createBestPayComparisonSession('user_001', {
      entryMode: 'wizard',
      wizard: {
        ...DEFAULT_SALES_WIZARD_STATE,
        enabled: true,
        prospectDraft: { ...DEFAULT_SALES_WIZARD_STATE.prospectDraft },
        scenarios: [],
      },
    });
    session.title = formatBestPayComparisonFallbackTitle(session.createdAt);
    expect(isEmptyAdviceSession(session)).toBe(true);
    expect(canDiscardEmptyAdviceSession(session)).toBe(true);
  });

  it('erkennt Kundenname als befüllt', () => {
    const session = createBestPayComparisonSession('user_001', {
      wizard: {
        ...DEFAULT_SALES_WIZARD_STATE,
        enabled: true,
        prospectDraft: {
          ...DEFAULT_SALES_WIZARD_STATE.prospectDraft,
          companyName: 'Café Nord',
        },
        scenarios: [],
      },
    });
    expect(isEmptyAdviceSession(session)).toBe(false);
  });

  it('erkennt Lead-/Offer-Verknüpfung als befüllt', () => {
    expect(
      isEmptyAdviceSession(
        createBestPayComparisonSession('user_001', { leadId: 'lead_001' }),
      ),
    ).toBe(false);
    expect(
      isEmptyAdviceSession(
        createBestPayComparisonSession('user_001', { offerId: 'offer_001' }),
      ),
    ).toBe(false);
  });

  it('erkennt manuelle Kosten als befüllt', () => {
    const session = createBestPayComparisonSession('user_001');
    session.manualInput.monthlyTotalCostsCents = 25000;
    expect(isEmptyAdviceSession(session)).toBe(false);
  });

  it('schützt nicht leere Entwürfe vor uneingeschränktem Löschen', () => {
    const session = createBestPayComparisonSession('user_001', {
      customerLabel: 'Mit Daten',
    });
    expect(canDiscardEmptyAdviceSession(session)).toBe(false);
  });
});
