import { useMemo, type ReactNode } from 'react';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { EmptyState } from '../../components/feedback/EmptyState';
import { loadAppRuntimeConfig } from '../../config/appRuntimeConfig';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { createUserContext } from '../../services/auditService';
import { AdminShell, type AdminShellNavItem } from '../layout/AdminShell';

export const COMMISSION_NAV: AdminShellNavItem[] = [
  { to: '/admin/commission/overview', label: 'Übersicht' },
  { to: '/admin/commission/standards', label: 'Standard & Vereinbarungen' },
  { to: '/admin/commission/cases', label: 'Provisionsfälle' },
  { to: '/admin/commission/bonus', label: 'Sonderzahlungen' },
  { to: '/admin/commission/settlement', label: 'Abrechnung & Historie' },
];

export function formatEuro(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

interface CommissionShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function CommissionShell({ title, description, actions, children }: CommissionShellProps) {
  const { currentUser, isLoading } = useCurrentUser();
  const { adminOverviewService } = useServices();
  const config = loadAppRuntimeConfig();

  // Memoisiert: verhindert, dass abhängige Effekte in Kindkomponenten (z. B.
  // `CommissionAssignmentsPanel`) bei jedem Render erneut feuern, weil eine neue
  // Objektreferenz sonst wie eine geänderte Abhängigkeit behandelt wird.
  const context = useMemo(
    () =>
      currentUser
        ? createUserContext({
            id: currentUser.id,
            role: currentUser.role,
            name: currentUser.name,
            status: currentUser.status,
          })
        : null,
    [currentUser?.id, currentUser?.role, currentUser?.name, currentUser?.status],
  );

  const isAuthorized = context ? adminOverviewService.canAccessAdmin(context) : false;

  if (isLoading) {
    return (
      <section>
        <EmptyState
          title="Administration wird geladen"
          description="Benutzerberechtigungen werden geprüft."
        />
      </section>
    );
  }

  if (!isAuthorized || !context) {
    return (
      <section>
        <AccessDenied description="Die Administration ist nur für berechtigte Benutzer zugänglich." />
      </section>
    );
  }

  const banner = `${config.persistenceMode === 'supabase' ? 'Supabase-Kernbereiche · übrige Domains lokal · ' : 'Lokaler Datenmodus · '}${config.demoMode ? 'Demo-Modus aktiv' : 'Produktionskonfiguration'}${config.persistenceMode === 'local' ? ' · nicht cloud-synchronisiert' : ''}`;

  return (
    <AdminShell
      title={title}
      description={description}
      actions={actions}
      banner={banner}
      navItems={COMMISSION_NAV}
    >
      {children}
    </AdminShell>
  );
}
