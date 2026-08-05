import { ADVICE_PATH, LEGACY_SALES_WIZARD_PATH } from './routes';
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
 * Produktkern-Navigation:
 * Arbeitsplatz · Kunden · Beratung · Angebote · Provision · Verwaltung (Admin) · Profil
 */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { to: '/sales', label: 'Arbeitsplatz', icon: 'sales' },
  { to: '/leads', label: 'Kunden', icon: 'leads' },
  { to: ADVICE_PATH, label: 'Beratung', icon: 'calculator' },
  { to: '/offers', label: 'Angebote', icon: 'offers' },
  { to: '/sales/commission', label: 'Provision', icon: 'commission', permission: 'commission.view' },
  { to: '/admin', label: 'Verwaltung', icon: 'admin', permission: 'admin.access' },
  { to: '/profile', label: 'Profil', icon: 'profile' },
];

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { to: '/sales', label: 'Arbeitsplatz', icon: 'sales' },
  { to: '/leads', label: 'Kunden', icon: 'leads' },
  { to: ADVICE_PATH, label: 'Beratung', icon: 'calculator' },
  { to: '/offers', label: 'Angebote', icon: 'offers' },
  { to: '/sales/commission', label: 'Provision', icon: 'commission', permission: 'commission.view' },
  { to: '/admin', label: 'Verwaltung', icon: 'admin', permission: 'admin.access' },
  { to: '/profile', label: 'Profil', icon: 'profile' },
];

export const OPERATIVE_SIDEBAR_NAV_LABELS = [
  'Arbeitsplatz',
  'Kunden',
  'Beratung',
  'Angebote',
  'Provision',
] as const;

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
      (pathname.startsWith('/sales/') &&
        !pathname.startsWith('/sales/commission') &&
        pathname !== LEGACY_SALES_WIZARD_PATH &&
        !pathname.startsWith(`${LEGACY_SALES_WIZARD_PATH}/`))
    );
  }
  if (item.to === '/leads') {
    return pathname === '/leads' || pathname.startsWith('/leads/');
  }
  if (item.to === ADVICE_PATH) {
    return (
      pathname === ADVICE_PATH ||
      pathname.startsWith(`${ADVICE_PATH}/`) ||
      pathname === '/calculator' ||
      pathname.startsWith('/calculator/') ||
      pathname === LEGACY_SALES_WIZARD_PATH ||
      pathname.startsWith(`${LEGACY_SALES_WIZARD_PATH}/`)
    );
  }
  if (item.to === '/offers') {
    return pathname === '/offers' || pathname.startsWith('/offers/');
  }
  if (item.to === '/sales/commission') {
    return pathname === '/sales/commission' || pathname.startsWith('/sales/commission/');
  }
  if (item.to === '/admin') {
    return pathname === '/admin' || pathname.startsWith('/admin/');
  }
  if (item.to === '/profile') {
    return pathname === '/profile' || pathname.startsWith('/profile/');
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
