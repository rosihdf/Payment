import type { ReactNode } from 'react';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { loadAppRuntimeConfig } from '../../config/appRuntimeConfig';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { createUserContext } from '../../services/auditService';
import { AdminShell, ADMIN_SHELL_NAV } from '../../v2/layout/AdminShell';

interface AdminLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

function buildModeBanner(): string {
  const config = loadAppRuntimeConfig();
  const parts = [
    config.persistenceMode === 'supabase'
      ? 'Supabase-Kernbereiche · übrige Domains lokal · '
      : 'Lokaler Datenmodus · ',
    config.demoMode ? 'Demo-Modus aktiv' : 'Produktionskonfiguration',
  ];
  if (config.persistenceMode === 'local') {
    parts.push(' · nicht cloud-synchronisiert');
  }
  return parts.join('');
}

export function AdminLayout({ title, subtitle, actions, children }: AdminLayoutProps) {
  const { currentUser, isLoading } = useCurrentUser();
  const { adminOverviewService } = useServices();

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
    <AdminShell
      title={title}
      description={subtitle ?? 'Zentrale Stammdaten, Betrieb und Datenschutz'}
      actions={actions}
      banner={buildModeBanner()}
      navItems={ADMIN_SHELL_NAV}
    >
      {children}
    </AdminShell>
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
