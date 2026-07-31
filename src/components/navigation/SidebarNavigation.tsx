import { Link, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  filterNavItemsByRole,
  isSidebarNavItemActive,
  SIDEBAR_NAV_ITEMS,
} from '../../utils/navigation';
import styles from './SidebarNavigation.module.css';

function NavIcon({ icon }: { icon: string }) {
  const icons: Record<string, string> = {
    home: '⌂',
    sales: '◎',
    leads: '☰',
    add: '+',
    offers: '◈',
    contracts: '▤',
    activations: '⚡',
    calculator: '∑',
    wizard: '⇢',
    tariffs: '€',
    products: '▣',
    admin: '⚙',
    profile: '◉',
  };

  return <span className={styles.icon} aria-hidden="true">{icons[icon] ?? '•'}</span>;
}

export function SidebarNavigation() {
  const { currentUser } = useCurrentUser();
  const { pathname } = useLocation();
  const role = currentUser?.role ?? 'field_service';
  const items = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, role);

  return (
    <nav className={styles.nav} aria-label="Seitenleiste">
      <p className={styles.heading}>Navigation</p>
      <ul className={styles.list}>
        {items.map((item) => {
          const active = isSidebarNavItemActive(pathname, item);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={active ? `${styles.link} ${styles.active}` : styles.link}
                aria-current={active ? 'page' : undefined}
              >
                <NavIcon icon={item.icon} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
