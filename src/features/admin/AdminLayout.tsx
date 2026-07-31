import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { loadAppRuntimeConfig } from '../../config/appRuntimeConfig';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { createUserContext } from '../../services/auditService';
import styles from './AdminLayout.module.css';

const ADMIN_NAV = [
  { to: '/admin', label: 'Übersicht', end: true },
  { to: '/admin/users', label: 'Benutzer' },
  { to: '/admin/roles', label: 'Rollen & Rechte' },
  { to: '/admin/pricing', label: 'Tarife & Preise' },
  { to: '/admin/products', label: 'Produkte & Hardware' },
  { to: '/admin/commission', label: 'Provision' },
  { to: '/admin/approvals', label: 'Freigaberegeln' },
  { to: '/admin/templates', label: 'Vorlagen' },
  { to: '/admin/data', label: 'Daten & Sicherung' },
  { to: '/admin/audit', label: 'Audit' },
  { to: '/admin/system', label: 'Systemstatus' },
] as const;

interface AdminLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminLayout({ title, subtitle, actions, children }: AdminLayoutProps) {
  const { currentUser, isLoading } = useCurrentUser();
  const { adminOverviewService } = useServices();
  const location = useLocation();
  const config = loadAppRuntimeConfig();

  const context =
    currentUser &&
    createUserContext({
      id: currentUser.id,
      role: currentUser.role,
      name: currentUser.name,
      status: currentUser.status,
    });

  const isAuthorized = context ? adminOverviewService.canAccessAdmin(context) : false;

  if (isLoading) {
    return (
      <section>
        <PageHeader title={title} subtitle="Berechtigungen werden geprüft…" />
        <EmptyState title="Administration wird geladen" description="Benutzerberechtigungen werden geprüft." />
      </section>
    );
  }

  if (!isAuthorized || !context) {
    return (
      <section>
        <PageHeader title={title} />
        <AccessDenied description="Die Administration ist nur für berechtigte Benutzer zugänglich." />
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <PageHeader
        title={title}
        subtitle={subtitle ?? 'Zentrale Stammdaten, Betrieb und Datenschutz'}
        actions={actions}
      />
      <p className={styles.modeBanner}>
        Lokaler Datenmodus · {config.demoMode ? 'Demo-Modus aktiv' : 'Produktionskonfiguration'} · nicht cloud-synchronisiert
      </p>
      <nav className={styles.subnav} aria-label="Administration">
        {ADMIN_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : false}
            className={({ isActive }) =>
              isActive || (item.to !== '/admin' && location.pathname.startsWith(item.to))
                ? `${styles.subnavLink} ${styles.subnavLinkActive}`
                : styles.subnavLink
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.content}>{children}</div>
    </section>
  );
}

export function useAdminContext() {
  const { currentUser } = useCurrentUser();
  if (!currentUser) {
    return null;
  }
  return createUserContext({
    id: currentUser.id,
    role: currentUser.role,
    name: currentUser.name,
    status: currentUser.status,
  });
}
