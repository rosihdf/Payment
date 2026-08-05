import { describe, expect, it } from 'vitest';
import {
  filterNavItemsByRole,
  isSidebarNavItemActive,
  MOBILE_NAV_ITEMS,
  OPERATIVE_SIDEBAR_NAV_LABELS,
  SIDEBAR_NAV_ITEMS,
} from '../utils/navigation';
import { ADVICE_PATH, LEGACY_SALES_WIZARD_PATH } from '../utils/routes';

describe('Navigation role filtering', () => {
  it('enthält die Zielnavigation inkl. Angebote, Provision und Profil', () => {
    expect(SIDEBAR_NAV_ITEMS.map((item) => item.label)).toEqual([
      'Arbeitsplatz',
      'Kunden',
      'Beratung',
      'Angebote',
      'Provision',
      'Verwaltung',
      'Profil',
    ]);
    expect(MOBILE_NAV_ITEMS.map((item) => item.label)).toEqual([
      'Arbeitsplatz',
      'Kunden',
      'Beratung',
      'Angebote',
      'Provision',
      'Verwaltung',
      'Profil',
    ]);
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.to === '/profile')).toBe(true);
    expect(MOBILE_NAV_ITEMS.some((item) => item.to === '/profile')).toBe(true);
  });

  it('zeigt Provision für field_service, blendet Verwaltung aus', () => {
    const items = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service');
    expect(items.some((item) => item.to === '/admin')).toBe(false);
    expect(items.some((item) => item.to === '/sales/commission' && item.label === 'Provision')).toBe(
      true,
    );
    expect(items.map((item) => item.label)).toEqual([
      'Arbeitsplatz',
      'Kunden',
      'Beratung',
      'Angebote',
      'Provision',
      'Profil',
    ]);
  });

  it('shows admin items for admin role', () => {
    const items = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'admin');
    expect(items.some((item) => item.to === '/admin' && item.label === 'Verwaltung')).toBe(true);
  });

  it('entfernt parallele Einstiege aus der Hauptnavigation', () => {
    const labels = SIDEBAR_NAV_ITEMS.map((item) => item.label);
    const routes = SIDEBAR_NAV_ITEMS.map((item) => item.to);

    expect(labels).not.toContain('Start');
    expect(labels).not.toContain('Vertrieb');
    expect(labels).not.toContain('Vertriebsprozess');
    expect(labels).not.toContain('Leads');
    expect(labels).not.toContain('Verträge');
    expect(labels).not.toContain('Aktivierungen');
    expect(labels).not.toContain('Rechner');
    expect(labels).not.toContain('Produkte');
    expect(labels).toContain('Angebote');
    expect(labels).toContain('Provision');
    expect(routes).toContain(ADVICE_PATH);
    expect(routes).toContain('/offers');
    expect(routes).toContain('/sales/commission');
    expect(routes).toContain('/profile');
    expect(routes).not.toContain('/contracts');
    expect(routes).not.toContain('/activations');
    expect(routes).not.toContain('/products');
    expect(routes).not.toContain(LEGACY_SALES_WIZARD_PATH);
    expect(routes).not.toContain('/calculator');
  });

  it('enthält keinen Hauptmenüpunkt Neuer Lead', () => {
    const fieldServiceItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service');
    expect(fieldServiceItems.some((item) => item.to === '/leads/new')).toBe(false);
  });

  it('sortiert operative Navigation in der vorgesehenen Reihenfolge', () => {
    const fieldServiceItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service');
    const operativeLabels = fieldServiceItems
      .slice(0, OPERATIVE_SIDEBAR_NAV_LABELS.length)
      .map((item) => item.label);

    expect(operativeLabels).toEqual([...OPERATIVE_SIDEBAR_NAV_LABELS]);
  });

  it('markiert Beratung bei Advice-, Wizard- und Rechner-Routen als aktiv', () => {
    const beratungItem = SIDEBAR_NAV_ITEMS.find((item) => item.to === ADVICE_PATH)!;
    const arbeitsplatzItem = SIDEBAR_NAV_ITEMS.find((item) => item.to === '/sales')!;

    expect(isSidebarNavItemActive(ADVICE_PATH, beratungItem)).toBe(true);
    expect(isSidebarNavItemActive(`${ADVICE_PATH}/quick`, beratungItem)).toBe(true);
    expect(isSidebarNavItemActive(LEGACY_SALES_WIZARD_PATH, beratungItem)).toBe(true);
    expect(isSidebarNavItemActive('/calculator/bestpay', beratungItem)).toBe(true);
    expect(isSidebarNavItemActive(ADVICE_PATH, arbeitsplatzItem)).toBe(false);
    expect(isSidebarNavItemActive('/sales', arbeitsplatzItem)).toBe(true);
    expect(isSidebarNavItemActive('/sales/commission', arbeitsplatzItem)).toBe(false);
  });

  it('markiert Kunden und Angebote auf den jeweiligen Routen als aktiv', () => {
    const kundenItem = SIDEBAR_NAV_ITEMS.find((item) => item.to === '/leads')!;
    const angeboteItem = SIDEBAR_NAV_ITEMS.find((item) => item.to === '/offers')!;
    const provisionItem = SIDEBAR_NAV_ITEMS.find((item) => item.to === '/sales/commission')!;

    expect(isSidebarNavItemActive('/leads/lead_001', kundenItem)).toBe(true);
    expect(isSidebarNavItemActive('/offers/offer_001', angeboteItem)).toBe(true);
    expect(isSidebarNavItemActive('/offers/offer_001', kundenItem)).toBe(false);
    expect(isSidebarNavItemActive('/sales/commission', provisionItem)).toBe(true);
  });
});
