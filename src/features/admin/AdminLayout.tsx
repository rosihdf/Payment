import type { ReactNode } from 'react';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { EmptyState } from '../../components/feedback/EmptyState';
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

  let body: ReactNode;
  let description = subtitle ?? 'Zentrale Stammdaten, Betrieb und Datenschutz';
  let shellActions = actions;
  let banner: ReactNode;

  if (isLoading) {
    description = 'Berechtigungen werden geprüft…';
    shellActions = undefined;
    body = (
      <EmptyState
        title="Administration wird geladen"
        description="Benutzerberechtigungen werden geprüft."
      />
    );
  } else if (!isAuthorized || !context) {
    shellActions = undefined;
    body = (
      <AccessDenied description="Die Administration ist nur für berechtigte Benutzer zugänglich." />
    );
  } else {
    banner = buildModeBanner();
    body = children;
  }

  return (
    <AdminShell
      title={title}
      description={description}
      actions={shellActions}
      banner={banner}
      navItems={ADMIN_SHELL_NAV}
    >
      {body}
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
