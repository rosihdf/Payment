import type { ReactNode } from 'react';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';

interface AdminProductLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminProductLayout({
  title,
  subtitle,
  actions,
  children,
}: AdminProductLayoutProps) {
  const { currentUser, isLoading: isUserLoading } = useCurrentUser();
  const { productService } = useServices();

  const isAuthorized = currentUser
    ? productService.canManageProducts({ role: currentUser.role })
    : false;

  if (isUserLoading) {
    return (
      <section>
        <PageHeader title={title} subtitle="Berechtigungen werden geprüft…" />
        <EmptyState
          title="Produktverwaltung wird geladen"
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
          description="Die Produktverwaltung ist nur für Benutzer mit der Rolle Admin zugänglich."
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
