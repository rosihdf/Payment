import { describe, expect, it } from 'vitest';
import { filterNavItemsByRole, SIDEBAR_NAV_ITEMS } from '../utils/navigation';

describe('Navigation role filtering', () => {
  it('hides admin items for field service role', () => {
    const items = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service');
    expect(items.some((item) => item.to === '/admin/tariffs')).toBe(false);
  });

  it('shows admin items for admin role', () => {
    const items = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'admin');
    expect(items.some((item) => item.to === '/admin/tariffs')).toBe(true);
  });
});
