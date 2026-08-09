import { describe, expect, it } from 'vitest';
import {
  getOfferPrimaryStatusLabel,
  getOfferWorkflowDisplayGroup,
  matchesOfferPhaseFilter,
  OFFER_PRIMARY_STATUS_LABELS,
} from '../features/offer/offerWorkflowDisplay';

describe('offerWorkflowDisplay', () => {
  it('maps workflow statuses to distinct display groups', () => {
    expect(getOfferWorkflowDisplayGroup('draft')).toBe('draft');
    expect(getOfferWorkflowDisplayGroup('in_approval')).toBe('approval');
    expect(getOfferWorkflowDisplayGroup('ready_to_send')).toBe('ready_to_send');
    expect(getOfferWorkflowDisplayGroup('sent')).toBe('sent');
    expect(getOfferWorkflowDisplayGroup('accepted')).toBe('accepted');
    expect(getOfferWorkflowDisplayGroup('declined')).toBe('declined');
    expect(getOfferWorkflowDisplayGroup('cancelled')).toBe('cancelled');
    expect(getOfferWorkflowDisplayGroup('expired')).toBe('expired');
  });

  it('uses primary labels that are fachlich verständlich', () => {
    expect(getOfferPrimaryStatusLabel('in_approval')).toBe('In Freigabe');
    expect(getOfferPrimaryStatusLabel('sent')).toBe('Beim Kunden');
    expect(getOfferPrimaryStatusLabel('cancelled')).toBe('Storniert');
    expect(getOfferPrimaryStatusLabel('declined')).toBe('Abgelehnt');
    expect(OFFER_PRIMARY_STATUS_LABELS.cancelled).not.toBe(OFFER_PRIMARY_STATUS_LABELS.declined);
  });

  it('maps phase filters to technical statuses', () => {
    expect(matchesOfferPhaseFilter('draft', 'draft_editing')).toBe(true);
    expect(matchesOfferPhaseFilter('in_approval', 'draft_editing')).toBe(false);
    expect(matchesOfferPhaseFilter('in_approval', 'approval')).toBe(true);
    expect(matchesOfferPhaseFilter('sent', 'sent')).toBe(true);
    expect(matchesOfferPhaseFilter('cancelled', 'declined')).toBe(false);
    expect(matchesOfferPhaseFilter('cancelled', 'cancelled')).toBe(true);
    expect(matchesOfferPhaseFilter('paid', 'archived')).toBe(true);
    expect(matchesOfferPhaseFilter('draft', 'archived')).toBe(false);
  });
});
