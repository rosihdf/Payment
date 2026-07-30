import { NavLink } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { filterNavItemsByRole, MOBILE_NAV_ITEMS } from '../../utils/navigation';
import styles from './BottomNavigation.module.css';

function NavIcon({ icon }: { icon: string }) {
  const icons: Record<string, string> = {
    home: '⌂',
    leads: '☰',
    add: '+',
    calculator: '∑',
    profile: '◉',
  };

  return <span aria-hidden="true">{icons[icon] ?? '•'}</span>;
}

export function BottomNavigation() {
  const { currentUser } = useCurrentUser();
  const role = currentUser?.role ?? 'field_service';
  const items = filterNavItemsByRole(MOBILE_NAV_ITEMS, role);

  return (
    <nav className={styles.nav} aria-label="Hauptnavigation">
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.active}` : styles.link
              }
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
