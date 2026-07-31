import { NavLink } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLocation } from 'react-router-dom';
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
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={() =>
                isSidebarNavItemActive(pathname, item)
                  ? `${styles.link} ${styles.active}`
                  : styles.link
              }
              aria-current={isSidebarNavItemActive(pathname, item) ? 'page' : undefined}
              end={item.to === '/'}
            >
              <NavIcon icon={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
