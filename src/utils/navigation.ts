import { SALES_WIZARD_PATH } from './routes';
import type { UserRole } from '../domain/user/user';
import { hasPermission } from '../domain/permission/permission';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: UserRole[];
  permission?: import('../domain/permission/permission').Permission;
}

/**
 * Vereinfachte operative Navigation.
 * Fachrouten (/offers, /contracts, /activations, Wizard) bleiben erreichbar,
 * erscheinen aber nicht mehr als parallele Hauptmenüpunkte.
 */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { to: '/sales', label: 'Arbeitsplatz', icon: 'sales' },
  { to: '/leads', label: 'Kunden', icon: 'leads' },
  { to: '/calculator', label: 'Beratung', icon: 'calculator' },
];

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { to: '/sales', label: 'Arbeitsplatz', icon: 'sales' },
  { to: '/leads', label: 'Kunden', icon: 'leads' },
  { to: '/calculator', label: 'Beratung', icon: 'calculator' },
  { to: '/admin', label: 'Verwaltung', icon: 'admin', permission: 'admin.access' },
];

export const OPERATIVE_SIDEBAR_NAV_LABELS = ['Arbeitsplatz', 'Kunden', 'Beratung'] as const;

export function filterNavItemsByRole(items: NavItem[], role: UserRole): NavItem[] {
  return items.filter((item) => {
    if (item.permission) {
      return hasPermission(role, item.permission);
    }
    return !item.roles || item.roles.includes(role);
  });
}

export function isSidebarNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.to === '/sales') {
    return (
      pathname === '/sales' ||
      pathname === '/' ||
      (pathname.startsWith('/sales/') && !pathname.startsWith(SALES_WIZARD_PATH))
    );
  }
  if (item.to === '/leads') {
    return (
      pathname === '/leads' ||
      pathname.startsWith('/leads/') ||
      pathname === '/offers' ||
      pathname.startsWith('/offers/') ||
      pathname === '/contracts' ||
      pathname.startsWith('/contracts/') ||
      pathname === '/activations' ||
      pathname.startsWith('/activations/')
    );
  }
  if (item.to === '/calculator') {
    return (
      pathname === '/calculator' ||
      pathname.startsWith('/calculator/') ||
      pathname === SALES_WIZARD_PATH ||
      pathname.startsWith(`${SALES_WIZARD_PATH}/`)
    );
  }
  if (item.to === '/admin') {
    return pathname === '/admin' || pathname.startsWith('/admin/');
  }
  if (item.to === '/profile') {
    return pathname === '/profile' || pathname.startsWith('/profile/');
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
