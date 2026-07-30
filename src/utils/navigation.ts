export interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: Array<'field_service' | 'admin'>;
}

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Start', icon: 'home' },
  { to: '/leads', label: 'Leads', icon: 'leads' },
  { to: '/offers', label: 'Angebote', icon: 'offers' },
  { to: '/products', label: 'Produkte', icon: 'products' },
  { to: '/profile', label: 'Profil', icon: 'profile' },
];

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Start', icon: 'home' },
  { to: '/leads', label: 'Leads', icon: 'leads' },
  { to: '/leads/new', label: 'Neuer Lead', icon: 'add' },
  { to: '/offers', label: 'Angebote', icon: 'offers' },
  { to: '/products', label: 'Produkte', icon: 'products' },
  { to: '/calculator', label: 'Rechner', icon: 'calculator' },
  { to: '/admin/tariffs', label: 'Tarife', icon: 'tariffs', roles: ['admin'] },
  { to: '/admin/products', label: 'Produkte verwalten', icon: 'products', roles: ['admin'] },
  { to: '/profile', label: 'Profil', icon: 'profile' },
];

export function filterNavItemsByRole(
  items: NavItem[],
  role: 'field_service' | 'admin',
): NavItem[] {
  return items.filter((item) => !item.roles || item.roles.includes(role));
}
