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

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Start', icon: 'home' },
  { to: '/sales', label: 'Vertrieb', icon: 'sales' },
  { to: '/leads', label: 'Leads', icon: 'leads' },
  { to: '/offers', label: 'Angebote', icon: 'offers' },
  { to: '/profile', label: 'Profil', icon: 'profile' },
];

/** Operative Sidebar-Reihenfolge, gefolgt von Verwaltung und Profil. */
export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Start', icon: 'home' },
  { to: '/sales', label: 'Vertrieb', icon: 'sales' },
  { to: SALES_WIZARD_PATH, label: 'Vertriebsprozess', icon: 'wizard' },
  { to: '/leads', label: 'Leads', icon: 'leads' },
  { to: '/offers', label: 'Angebote', icon: 'offers' },
  { to: '/calculator', label: 'Rechner', icon: 'calculator' },
  { to: '/products', label: 'Produkte', icon: 'products' },
  { to: '/admin', label: 'Administration', icon: 'admin', permission: 'admin.access' },
  { to: '/profile', label: 'Profil', icon: 'profile' },
];

export const OPERATIVE_SIDEBAR_NAV_LABELS = [
  'Start',
  'Vertrieb',
  'Vertriebsprozess',
  'Leads',
  'Angebote',
  'Rechner',
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
  if (item.to === '/') {
    return pathname === '/';
  }
  if (item.to === SALES_WIZARD_PATH) {
    return pathname === SALES_WIZARD_PATH || pathname.startsWith(`${SALES_WIZARD_PATH}/`);
  }
  if (item.to === '/sales') {
    return (
      pathname === '/sales' ||
      (pathname.startsWith('/sales/') && !pathname.startsWith(SALES_WIZARD_PATH))
    );
  }
  if (item.to === '/calculator') {
    return pathname === '/calculator' || pathname.startsWith('/calculator/');
  }
  if (item.to === '/admin') {
    return pathname === '/admin' || pathname.startsWith('/admin/');
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
