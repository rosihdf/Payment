import { describe, expect, it } from 'vitest';
import {
  canUserAccessLead,
  canUserAssignLeadAdvisor,
  filterLeadsByVisibility,
  getAdvisorDisplayLabel,
} from '../domain/lead/leadVisibility';

describe('leadVisibility', () => {
  const own = { assignedSalesUserId: 'user_a' };
  const foreign = { assignedSalesUserId: 'user_b' };
  const unassigned = { assignedSalesUserId: '' };

  it('allows admin full access including unassigned', () => {
    const admin = { userId: 'admin', role: 'admin' as const };
    expect(canUserAccessLead(own, admin)).toBe(true);
    expect(canUserAccessLead(foreign, admin)).toBe(true);
    expect(canUserAccessLead(unassigned, admin)).toBe(true);
    expect(canUserAssignLeadAdvisor(admin)).toBe(true);
  });

  it('restricts field service to assigned customers only', () => {
    const field = { userId: 'user_a', role: 'field_service' as const };
    expect(canUserAccessLead(own, field)).toBe(true);
    expect(canUserAccessLead(foreign, field)).toBe(false);
    expect(canUserAccessLead(unassigned, field)).toBe(false);
    expect(canUserAssignLeadAdvisor(field)).toBe(false);
  });

  it('filters lists consistently', () => {
    const field = { userId: 'user_a', role: 'field_service' as const };
    expect(filterLeadsByVisibility([own, foreign, unassigned], field)).toEqual([own]);
  });

  it('labels missing advisors clearly', () => {
    expect(getAdvisorDisplayLabel('', () => 'X')).toBe('Nicht zugewiesen');
    expect(getAdvisorDisplayLabel('user_a', () => 'Laura')).toBe('Laura');
    expect(getAdvisorDisplayLabel('missing', () => null)).toBe('Unbekannt');
  });
});
