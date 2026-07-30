import { describe, expect, it } from 'vitest';
import { filterNavItemsByRole, MOBILE_NAV_ITEMS, SIDEBAR_NAV_ITEMS } from '../utils/navigation';

describe('Navigation role filtering', () => {
  it('hides admin items for field service role', () => {
    const items = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service');
    expect(items.some((item) => item.to === '/admin/tariffs')).toBe(false);
    expect(items.some((item) => item.to === '/admin/products')).toBe(false);
  });

  it('shows admin items for admin role', () => {
    const items = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'admin');
    expect(items.some((item) => item.to === '/admin/tariffs')).toBe(true);
    expect(items.some((item) => item.to === '/admin/products')).toBe(true);
  });

  it('shows product overview for all roles', () => {
    const fieldServiceItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service');
    const adminItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'admin');

    expect(fieldServiceItems.some((item) => item.to === '/products')).toBe(true);
    expect(adminItems.some((item) => item.to === '/products')).toBe(true);
  });

  it('shows offers nav entry for all roles', () => {
    const fieldServiceItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service');
    const adminItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'admin');
    const mobileItems = filterNavItemsByRole(MOBILE_NAV_ITEMS, 'field_service');

    expect(fieldServiceItems.some((item) => item.to === '/offers' && item.label === 'Angebote')).toBe(
      true,
    );
    expect(adminItems.some((item) => item.to === '/offers' && item.label === 'Angebote')).toBe(true);
    expect(mobileItems.some((item) => item.to === '/offers' && item.label === 'Angebote')).toBe(true);
  });
});
