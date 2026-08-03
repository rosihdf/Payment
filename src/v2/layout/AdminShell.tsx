import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { PageHeader } from '../ui/PageHeader';
import styles from './AdminShell.module.css';

export interface AdminShellNavItem {
  to: string;
  label: string;
  end?: boolean;
  isActive?: (pathname: string, isActive: boolean) => boolean;
}

export interface AdminShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  banner?: ReactNode;
  navItems: AdminShellNavItem[];
  children: ReactNode;
}

export function AdminShell({
  title,
  description,
  actions,
  banner,
  navItems,
  children,
}: AdminShellProps) {
  const { pathname } = useLocation();

  return (
    <section className={styles.section}>
      <PageHeader title={title} description={description} actions={actions} />
      {banner ? <p className={styles.banner}>{banner}</p> : null}
      <nav className={styles.subnav} aria-label="Administration">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => {
              const active = item.isActive ? item.isActive(pathname, isActive) : isActive;
              return active
                ? `${styles.subnavLink} ${styles.subnavLinkActive}`
                : styles.subnavLink;
            }}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.content}>{children}</div>
    </section>
  );
}

export const ADMIN_SHELL_NAV: AdminShellNavItem[] = [
  { to: '/admin', label: 'Übersicht', end: true },
  { to: '/admin/users', label: 'Benutzer' },
  { to: '/admin/roles', label: 'Rollen' },
  { to: '/admin/catalog', label: 'Produkte & Konditionen' },
  { to: '/admin/commission', label: 'Provision' },
  { to: '/admin/approvals', label: 'Freigaberegeln' },
  { to: '/admin/templates', label: 'Vorlagen' },
  { to: '/admin/data', label: 'Daten & Sicherung' },
  { to: '/admin/audit', label: 'Audit' },
  { to: '/admin/system', label: 'Systemstatus' },
];
