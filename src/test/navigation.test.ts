import { describe, expect, it } from 'vitest';
import {
  filterNavItemsByRole,
  isSidebarNavItemActive,
  MOBILE_NAV_ITEMS,
  OPERATIVE_SIDEBAR_NAV_LABELS,
  SIDEBAR_NAV_ITEMS,
} from '../utils/navigation';
import { SALES_WIZARD_PATH } from '../utils/routes';

describe('Navigation role filtering', () => {
  it('hides admin items for field service role', () => {
    const items = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service');
    expect(items.some((item) => item.to === '/admin')).toBe(false);
  });

  it('shows admin items for admin role', () => {
    const items = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'admin');
    expect(items.some((item) => item.to === '/admin')).toBe(true);
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

  it('zeigt Vertriebsprozess und nicht Vertriebs-Wizard in der Sidebar', () => {
    const fieldServiceItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service');
    const adminItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'admin');

    expect(
      fieldServiceItems.some((item) => item.to === SALES_WIZARD_PATH && item.label === 'Vertriebsprozess'),
    ).toBe(true);
    expect(
      adminItems.some((item) => item.to === SALES_WIZARD_PATH && item.label === 'Vertriebsprozess'),
    ).toBe(true);
    expect(fieldServiceItems.some((item) => item.label === 'Vertriebs-Wizard')).toBe(false);
    expect(adminItems.some((item) => item.label === 'Vertriebs-Wizard')).toBe(false);
  });

  it('enthält keinen Hauptmenüpunkt Neuer Lead', () => {
    const fieldServiceItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service');
    const adminItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'admin');

    expect(fieldServiceItems.some((item) => item.to === '/leads/new')).toBe(false);
    expect(adminItems.some((item) => item.to === '/leads/new')).toBe(false);
  });

  it('sortiert operative Navigation in der vorgesehenen Reihenfolge', () => {
    const fieldServiceItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service');
    const operativeLabels = fieldServiceItems
      .slice(0, OPERATIVE_SIDEBAR_NAV_LABELS.length)
      .map((item) => item.label);

    expect(operativeLabels).toEqual([...OPERATIVE_SIDEBAR_NAV_LABELS]);
  });

  it('markiert Vertriebsprozess bei Wizard-Routen als aktiv', () => {
    const processItem = SIDEBAR_NAV_ITEMS.find((item) => item.to === SALES_WIZARD_PATH)!;
    const calculatorItem = SIDEBAR_NAV_ITEMS.find((item) => item.to === '/calculator')!;
    const salesItem = SIDEBAR_NAV_ITEMS.find((item) => item.to === '/sales')!;

    expect(isSidebarNavItemActive(SALES_WIZARD_PATH, processItem)).toBe(true);
    expect(isSidebarNavItemActive(SALES_WIZARD_PATH, calculatorItem)).toBe(false);
    expect(isSidebarNavItemActive(SALES_WIZARD_PATH, salesItem)).toBe(false);
    expect(isSidebarNavItemActive('/sales', salesItem)).toBe(true);
  });

  it('markiert Rechner bei Wizard-Routen nicht als aktiv', () => {
    const calculatorItem = SIDEBAR_NAV_ITEMS.find((item) => item.to === '/calculator')!;

    expect(isSidebarNavItemActive(SALES_WIZARD_PATH, calculatorItem)).toBe(false);
    expect(isSidebarNavItemActive('/calculator/bestpay', calculatorItem)).toBe(true);
  });
});
