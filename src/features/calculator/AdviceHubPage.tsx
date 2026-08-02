import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { PageHeader } from '../../components/layout/PageHeader';
import { SalesGuidePanel } from '../../components/sales/SalesGuidePanel';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import {
  canDiscardEmptyAdviceSession,
  isEmptyAdviceSession,
} from '../../domain/bestPayComparison/isEmptyAdviceSession';
import { getVisibleWizardStep } from '../../domain/bestPayComparison/salesWizard';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { ADVICE_NEW_PATH, adviceSessionPath } from '../../utils/routes';
import { formatDate } from '../../utils/format';
import styles from './AdviceHubPage.module.css';

function sessionTitle(session: BestPayComparisonSession): string {
  if (isEmptyAdviceSession(session)) {
    return 'Unbenannter Entwurf';
  }
  return (
    session.customerLabel ||
    session.leadDisplayName ||
    session.wizard.prospectDraft.companyName.trim() ||
    session.title ||
    'Unbenannter Entwurf'
  );
}

function sessionSourceLabel(session: BestPayComparisonSession): string | null {
  if (session.billingImportSessionId || session.source === 'billing_import') {
    return 'Abrechnung';
  }
  if (session.costBaselineId || session.manualInput.monthlyTotalCostsCents !== null) {
    return 'Manuelle Kosten';
  }
  if (session.leadId) {
    return 'Kunde zugeordnet';
  }
  if (isEmptyAdviceSession(session)) {
    return 'Leerer Entwurf';
  }
  return null;
}

export function AdviceHubPage() {
  const { currentUser } = useCurrentUser();
  const { bestPayComparisonService, salesWizardService } = useServices();
  const { showToast } = useToast();
  const [openSessions, setOpenSessions] = useState<BestPayComparisonSession[]>([]);
  const [recentCalculations, setRecentCalculations] = useState<BestPayComparisonSession[]>([]);
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
    const summaries = await bestPayComparisonService.listComparisons(userContext, {
      status: 'all',
      includeArchived: false,
    });
    const sessions = (
      await Promise.all(
        (summaries ?? []).map((summary) =>
          bestPayComparisonService.getSession(summary.id, userContext),
        ),
      )
    )
      .filter((session): session is BestPayComparisonSession => Boolean(session))
      .filter(
        (session) =>
          session.status !== 'discarded' &&
          !session.archivedAt &&
          (session.entryMode === 'wizard' || session.wizard.enabled) &&
          !session.wizard.wizardCompletedAt &&
          !session.completedAt,
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    setOpenSessions(sessions.slice(0, 12));
    setRecentCalculations(
      sessions
        .filter((session) => Boolean(session.result?.stale))
        .slice(0, 5),
    );
    setIsLoading(false);
  }, [bestPayComparisonService, currentUser]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pendingDelete = openSessions.find((session) => session.id === pendingDeleteId) ?? null;

  const handleConfirmDelete = () => {
    if (!currentUser || !pendingDelete) {
      return;
    }
    void salesWizardService
      .discardEmptyWizard(pendingDelete.id, {
        userId: currentUser.id,
        role: currentUser.role,
        displayName: currentUser.name,
      })
      .then((result) => {
        setPendingDeleteId(null);
        if (!result.ok) {
          showToast(
            result.error === 'not_empty'
              ? 'Nur leere Entwürfe können so gelöscht werden'
              : 'Entwurf konnte nicht gelöscht werden',
            'error',
          );
          return;
        }
        showToast('Leerer Entwurf verworfen', 'success');
        void reload();
      });
  };

  return (
    <section>
      <PageHeader
        title="Beratung"
        subtitle="Ein Weg vom Kunden über den Vergleich bis zum Angebot."
      />

      <SalesGuidePanel context="hub" tipSeed="advice-hub" compact />

      <article className={styles.hero}>
        <h2 className={styles.heroTitle}>Neue Beratung</h2>
        <p className={styles.heroText}>
          Für einen neuen oder bestehenden Kunden. Vergleich, Empfehlung und Angebot in einem
          durchgängigen Ablauf.
        </p>
        <Link className={styles.primaryAction} to={ADVICE_NEW_PATH}>
          Beratung starten
        </Link>
      </article>

      <section className={styles.section} aria-labelledby="continue-heading">
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
          <ul className={styles.list}>
            {openSessions.map((session) => {
              const step = getVisibleWizardStep(session.wizard.currentStep);
              const source = sessionSourceLabel(session);
              const empty = canDiscardEmptyAdviceSession(session);
              return (
                <li key={session.id} className={styles.sessionRow}>
                  <Link className={styles.sessionCard} to={adviceSessionPath(session.id)}>
                    <span className={styles.sessionTitle}>{sessionTitle(session)}</span>
                    <span className={styles.sessionMeta}>
                      {formatDate(session.updatedAt)}
                      {' · '}
                      {step.label}
                      {source ? ` · ${source}` : ''}
                      {' · Fortsetzen'}
                    </span>
                  </Link>
                  {empty ? (
                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={() => setPendingDeleteId(session.id)}
                    >
                      Löschen
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {recentCalculations.length > 0 ? (
        <section className={styles.section} aria-labelledby="recent-heading">
          <h2 id="recent-heading" className={styles.sectionTitle}>
            Aktualisierungsbedarf
          </h2>
          <ul className={styles.list}>
            {recentCalculations.map((session) => (
              <li key={session.id}>
                <Link className={styles.sessionCard} to={adviceSessionPath(session.id)}>
                  <span className={styles.sessionTitle}>
                    {session.customerLabel || session.title || 'Beratung'}
                  </span>
                  <span className={styles.sessionMeta}>
                    {formatDate(session.updatedAt)} · fortsetzen
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Leeren Entwurf löschen?"
        message="Dieser Beratungsentwurf enthält keine fachlichen Daten und wird verworfen."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </section>
  );
}
