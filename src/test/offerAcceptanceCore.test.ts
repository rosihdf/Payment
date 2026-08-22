import { describe, expect, it } from 'vitest';
import {
  isAcceptedOfferMissingContract,
  isOfferAcceptanceDuplicate,
  resolveContractCreationWorkflowStatus,
} from '../domain/offer/offerAcceptanceCore';

describe('offerAcceptanceCore', () => {
  it('erkennt Duplikat über Event oder accepted workflowStatus', () => {
    expect(
      isOfferAcceptanceDuplicate({
        workflowStatus: 'accepted',
        events: [],
        acceptanceEventSourceKey: 'acceptance:offer_1:ver_1',
      }),
    ).toBe(true);

    expect(
      isOfferAcceptanceDuplicate({
        workflowStatus: 'sent',
        events: [
          {
            id: 'event_1',
            schemaVersion: 1,
            type: 'acceptance',
            offerId: 'offer_1',
            offerVersionId: 'ver_1',
            createdAt: '2026-01-01T00:00:00.000Z',
            createdByUserId: 'user_1',
            createdByDisplayName: 'Test',
            note: 'acceptance:offer_1:ver_1',
            acceptedAt: '2026-01-01T00:00:00.000Z',
            acceptedByName: 'Kunde',
            acceptanceType: 'digital_confirmation',
            otherText: null,
          },
        ],
        acceptanceEventSourceKey: 'acceptance:offer_1:ver_1',
      }),
    ).toBe(true);
  });

  it('leitet Vertragserstellung aus accept-Transition ab', () => {
    expect(resolveContractCreationWorkflowStatus('sent')).toBe('accepted');
    expect(resolveContractCreationWorkflowStatus('accepted')).toBe('accepted');
    expect(resolveContractCreationWorkflowStatus('draft')).toBeNull();
  });

  it('markiert accepted ohne Vertrag als Inkonsistenz', () => {
    expect(
      isAcceptedOfferMissingContract({ workflowStatus: 'accepted', hasContract: false }),
    ).toBe(true);
    expect(
      isAcceptedOfferMissingContract({ workflowStatus: 'accepted', hasContract: true }),
    ).toBe(false);
    expect(
      isAcceptedOfferMissingContract({ workflowStatus: 'sent', hasContract: false }),
    ).toBe(false);
  });
});
