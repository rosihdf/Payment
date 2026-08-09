import { describe, expect, it } from 'vitest';
import {
  evaluateOfferDraftDeletion,
  offerDraftDeletionBlockerMessage,
  canCancelOfferWorkflow,
} from '../domain/offer/offerDraftDeletion';
import { createTestOffer } from './helpers/offerTestHelpers';

describe('offerDraftDeletion', () => {
  const baseOffer = createTestOffer({ workflowStatus: 'draft' });

  it('allows admin draft delete without dependencies', () => {
    const result = evaluateOfferDraftDeletion({
      offer: baseOffer,
      isAdmin: true,
      canAccess: true,
      dependencies: {
        hasContract: false,
        hasShareLink: false,
        hasGeneratedDocument: false,
        hasCommissionCase: false,
        hasActivationCase: false,
      },
    });

    expect(result).toEqual({ allowed: true });
  });

  it('blocks non-admin delete', () => {
    const result = evaluateOfferDraftDeletion({
      offer: baseOffer,
      isAdmin: false,
      canAccess: true,
      dependencies: {
        hasContract: false,
        hasShareLink: false,
        hasGeneratedDocument: false,
        hasCommissionCase: false,
        hasActivationCase: false,
      },
    });

    expect(result).toEqual({ allowed: false, blocker: 'not_admin' });
    expect(offerDraftDeletionBlockerMessage('not_admin')).toMatch(/Administratoren/i);
  });

  it('blocks delete for sent workflow status', () => {
    const result = evaluateOfferDraftDeletion({
      offer: createTestOffer({ workflowStatus: 'sent' }),
      isAdmin: true,
      canAccess: true,
      dependencies: {
        hasContract: false,
        hasShareLink: false,
        hasGeneratedDocument: false,
        hasCommissionCase: false,
        hasActivationCase: false,
      },
    });

    expect(result).toEqual({ allowed: false, blocker: 'workflow_not_draft' });
  });

  it('blocks delete when contract exists', () => {
    const result = evaluateOfferDraftDeletion({
      offer: baseOffer,
      isAdmin: true,
      canAccess: true,
      dependencies: {
        hasContract: true,
        hasShareLink: false,
        hasGeneratedDocument: false,
        hasCommissionCase: false,
        hasActivationCase: false,
      },
    });

    expect(result).toEqual({ allowed: false, blocker: 'has_contract' });
  });

  it('blocks delete when generated document exists', () => {
    const result = evaluateOfferDraftDeletion({
      offer: baseOffer,
      isAdmin: true,
      canAccess: true,
      dependencies: {
        hasContract: false,
        hasShareLink: false,
        hasGeneratedDocument: true,
        hasCommissionCase: false,
        hasActivationCase: false,
      },
    });

    expect(result).toEqual({ allowed: false, blocker: 'has_sent_document' });
  });

  it('defines cancel rules for terminal activation states', () => {
    expect(canCancelOfferWorkflow('sent')).toBe(true);
    expect(canCancelOfferWorkflow('accepted')).toBe(true);
    expect(canCancelOfferWorkflow('activated')).toBe(false);
    expect(canCancelOfferWorkflow('paid')).toBe(false);
    expect(canCancelOfferWorkflow('cancelled')).toBe(false);
  });
});
