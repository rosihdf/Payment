import { Link } from 'react-router-dom';
import type { BestPayComparisonSession } from '../../../domain/bestPayComparison/bestPayComparisonSession';
import { resolveSelectedScenarioVariant } from '../../../domain/bestPayComparison/salesWizard';
import { getSessionCustomerDisplayName } from '../../../domain/lead/getLeadDisplayName';
import type { Offer } from '../../../domain/offer/offer';
import type { OfferVersion } from '../../../domain/offer/offerVersion';
import { Button } from '../../ui/Button';
import { formatEuro } from '../formatters';
import { ADVICE_PATH } from '../../../utils/routes';
import styles from '../AdviceWizard.module.css';

interface ClosingStepProps {
  session: BestPayComparisonSession;
  busy: boolean;
  canSeeCommission: boolean;
  workflowView: {
    offer: Offer | null;
    version: OfferVersion | null;
    approvalRequired: boolean;
    approved: boolean;
    workflowStatus: Offer['workflowStatus'] | null;
  } | null;
  onComplete: () => void;
}

export function ClosingStep({
  session,
  busy,
  canSeeCommission,
  workflowView,
  onComplete,
}: ClosingStepProps) {
  const scenario =
    session.wizard.scenarios.find((entry) => entry.id === session.wizard.selectedScenarioId) ??
    null;
  const selectedVariant = resolveSelectedScenarioVariant(scenario);

  return (
    <div className={styles.stack}>
      <article className={styles.hero}>
        <h2 className={styles.sectionTitle}>Prüfung & Nachfassen</h2>
        <p className={styles.hint}>
          Kunde prüft in Ruhe. Versand, Wiedervorlage und externer BestPay-Handoff.
        </p>
        {workflowView ? (
          <dl className={styles.formGrid}>
            <div>
              <dt>Status</dt>
              <dd>{workflowView.workflowStatus ?? '—'}</dd>
            </div>
            <div>
              <dt>Freigabe</dt>
              <dd>{workflowView.approved ? 'Erledigt' : 'Offen'}</dd>
            </div>
          </dl>
        ) : null}
        <dl className={styles.formGrid}>
          <div>
            <dt>Kunde</dt>
            <dd>{getSessionCustomerDisplayName(session)}</dd>
          </div>
          <div>
            <dt>Gewählte Lösung</dt>
            <dd>{selectedVariant?.tariffName ?? '—'}</dd>
          </div>
          <div>
            <dt>BestPay monatlich</dt>
            <dd>{formatEuro(selectedVariant?.monthlyTotalCostsCents ?? null)}</dd>
          </div>
          {canSeeCommission ? (
            <div>
              <dt>Provision</dt>
              <dd>{formatEuro(selectedVariant?.commissionTotalCents ?? null)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Angebot</dt>
            <dd>{session.offerNumber ?? '—'}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          {!session.wizard.wizardCompletedAt ? (
            <Button loading={busy} onClick={onComplete}>
              Beratung abschließen
            </Button>
          ) : null}
          {session.offerId ? (
            <>
              <Link className={styles.choiceButton} to={`/offers/${session.offerId}`}>
                Angebot öffnen / versenden
              </Link>
              <Link className={styles.choiceButton} to={`/offers/${session.offerId}/preview`}>
                PDF-Vorschau
              </Link>
            </>
          ) : null}
          {session.leadId ? (
            <Link className={styles.choiceButton} to={`/leads/${session.leadId}`}>
              Kundenakte öffnen
            </Link>
          ) : null}
          <Link className={styles.choiceButton} to={ADVICE_PATH}>
            Zur Beratung
          </Link>
        </div>
      </article>
    </div>
  );
}
