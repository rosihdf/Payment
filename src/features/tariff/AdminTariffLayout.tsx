import type { ReactNode } from 'react';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';

interface AdminTariffLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminTariffLayout({
  title,
  subtitle,
  actions,
  children,
}: AdminTariffLayoutProps) {
  const { currentUser, isLoading: isUserLoading } = useCurrentUser();
  const { tariffService } = useServices();

  const isAuthorized = currentUser
    ? tariffService.canManageTariffs({ role: currentUser.role })
    : false;

  if (isUserLoading) {
    return (
      <section>
        <PageHeader title={title} subtitle="Berechtigungen werden geprüft…" />
        <EmptyState
          title="Tarifverwaltung wird geladen"
          description="Benutzerberechtigungen werden geprüft."
        />
      </section>
    );
  }

  if (!isAuthorized) {
    return (
      <section>
        <PageHeader title={title} />
        <AccessDenied
          description="Die Tarifverwaltung ist nur für Benutzer mit der Rolle Admin zugänglich."
        />
      </section>
    );
  }

  return (
    <section>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {children}
    </section>
  );
}
