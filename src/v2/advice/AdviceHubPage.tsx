import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import { isEmptyAdviceSession } from '../../domain/bestPayComparison/isEmptyAdviceSession';
import { getVisibleWizardStep } from '../../domain/bestPayComparison/salesWizard';
import { getSessionCustomerDisplayName } from '../../domain/lead/getLeadDisplayName';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { ADVICE_NEW_PATH, adviceSessionPath } from '../../utils/routes';
import { formatDate } from '../../utils/format';
import { Button } from '../ui/Button';
import { DataList, DataListCard } from '../ui/DataList';
import { PageHeader } from '../ui/PageHeader';
import styles from './AdviceHub.module.css';

function sessionTitle(session: BestPayComparisonSession): string {
  if (isEmptyAdviceSession(session)) {
    return 'Leerer Entwurf';
  }
  return getSessionCustomerDisplayName(session) || 'Unbenannter Entwurf';
}

export function AdviceHubPage() {
  const { currentUser } = useCurrentUser();
  const { bestPayComparisonService, salesWizardService } = useServices();
  const { showToast } = useToast();
  const [openSessions, setOpenSessions] = useState<BestPayComparisonSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!currentUser) {
      return;
    }
    const userContext = {
      userId: currentUser.id,
      role: currentUser.role,
      displayName: currentUser.name,
    };
    const sessions = await bestPayComparisonService.listActiveAdviceDrafts(userContext);
    const openSessions = sessions
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .reduce<BestPayComparisonSession[]>((acc, session) => {
        if (!session.leadId) {
          acc.push(session);
          return acc;
        }
        if (acc.some((entry) => entry.leadId === session.leadId)) {
          return acc;
        }
        acc.push(session);
        return acc;
      }, []);

    setOpenSessions(openSessions.slice(0, 12));
    setIsLoading(false);
  }, [bestPayComparisonService, currentUser]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pendingDelete = openSessions.find((session) => session.id === pendingDeleteId) ?? null;

  return (
    <section>
      <PageHeader
        title="Beratung"
        description="Ein Weg vom Kunden über die Empfehlung bis zum Angebot."
        actions={
          <Link to={ADVICE_NEW_PATH}>
            <Button>Beratung starten</Button>
          </Link>
        }
      />

      <article className={styles.hero}>
        <h2 className={styles.heroTitle}>Neue Beratung</h2>
        <p className={styles.heroText}>
          Für einen neuen oder bestehenden Kunden – Vergleich, Empfehlung und Angebot in einem
          Ablauf.
        </p>
      </article>

      <section aria-labelledby="continue-heading">
        <h2 id="continue-heading" className={styles.sectionTitle}>
          Beratung fortsetzen
        </h2>
        {isLoading ? (
          <EmptyState title="Wird geladen" description="Offene Beratungen werden vorbereitet." />
        ) : openSessions.length === 0 ? (
          <EmptyState
            title="Keine offenen Beratungen"
            description="Starten Sie eine neue Beratung oder öffnen Sie einen Kunden."
          />
        ) : (
          <DataList
            items={openSessions}
            getKey={(session) => session.id}
            aria-label="Offene Beratungen"
            renderItem={(session) => {
              const step = getVisibleWizardStep(session.wizard.currentStep);
              const canDelete = !session.offerId;
              return (
                <DataListCard
                  title={sessionTitle(session)}
                  badge="Fortsetzen"
                  meta={`${formatDate(session.updatedAt)} · ${step.label}`}
                  href={adviceSessionPath(session.id)}
                  footer={
                    canDelete ? (
                      <Button
                        variant="text"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setPendingDeleteId(session.id);
                        }}
                      >
                        Löschen
                      </Button>
                    ) : undefined
                  }
                />
              );
            }}
          />
        )}
      </section>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Beratungsentwurf löschen?"
        message="Der Entwurf wird verworfen. Bereits erzeugte Angebote bleiben erhalten."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        onConfirm={() => {
          if (!currentUser || !pendingDelete) {
            return;
          }
          void salesWizardService
            .discardAdviceDraft(pendingDelete.id, {
              userId: currentUser.id,
              role: currentUser.role,
              displayName: currentUser.name,
            })
            .then((result) => {
              setPendingDeleteId(null);
              if (!result.ok) {
                showToast(
                  result.error === 'has_offer'
                    ? 'Entwurf mit Angebot kann hier nicht gelöscht werden'
                    : 'Entwurf konnte nicht gelöscht werden',
                  'error',
                );
                return;
              }
              showToast('Beratungsentwurf gelöscht', 'success');
              void reload();
            });
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </section>
  );
}
