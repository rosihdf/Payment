import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { AdminLayout } from '../AdminLayout';
import styles from '../AdminLayout.module.css';

export const COMMISSION_NAV = [
  { to: '/admin/commission/overview', label: 'Übersicht' },
  { to: '/admin/commission/standards', label: 'Standard & Vereinbarungen' },
  { to: '/admin/commission/cases', label: 'Provisionsfälle' },
  { to: '/admin/commission/bonus', label: 'Sonderzahlungen' },
  { to: '/admin/commission/settlement', label: 'Abrechnung & Historie' },
] as const;

interface AdminCommissionLayoutProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminCommissionLayout({ title, actions, children }: AdminCommissionLayoutProps) {
  return (
    <AdminLayout title={title} actions={actions}>
      <nav className={styles.subnav} aria-label="Provision">
        {COMMISSION_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? `${styles.subnavLink} ${styles.subnavLinkActive}` : styles.subnavLink
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      {children}
    </AdminLayout>
  );
}

function formatEuro(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

export { formatEuro };
