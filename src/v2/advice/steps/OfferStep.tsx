import { Link } from 'react-router-dom';
import type { BestPayComparisonSession } from '../../../domain/bestPayComparison/bestPayComparisonSession';
import { resolveSelectedScenarioVariant } from '../../../domain/bestPayComparison/salesWizard';
import {
  APPROVAL_DEVIATION_FIELD_MESSAGE,
  APPROVAL_WAITING_STATUS_LABEL,
} from '../../../domain/sales/salesGuide';
import type { Offer } from '../../../domain/offer/offer';
import type { OfferVersion } from '../../../domain/offer/offerVersion';
import { Button } from '../../ui/Button';
import { textareaClassName } from '../../ui/FormField';
import formFieldStyles from '../../ui/FormField.module.css';
import { formatEuro } from '../formatters';
import { StatusBadge } from '../../ui/StatusBadge';
import styles from '../AdviceWizard.module.css';

interface OfferStepProps {
  session: BestPayComparisonSession;
  step: 'offer' | 'approval';
  busy: boolean;
  canSeeCommission: boolean;
  workflowView: {
    offer: Offer | null;
    version: OfferVersion | null;
    approvalRequired: boolean;
    approved: boolean;
    workflowStatus: Offer['workflowStatus'] | null;
  } | null;
  approvalNotes: string;
  onApprovalNotesChange: (value: string) => void;
  onCreateOffer: () => void;
  onSubmitApproval: () => void;
  onBackToRecommendation: () => void;
}

function offerWorkflowTabPath(offerId: string): string {
  return `/offers/${offerId}?tab=workflow`;
}

export function OfferStep({
  session,
  step,
  busy,
  canSeeCommission,
  workflowView,
  approvalNotes,
  onApprovalNotesChange,
  onCreateOffer,
  onSubmitApproval,
  onBackToRecommendation,
}: OfferStepProps) {
  const scenario =
    session.wizard.scenarios.find((entry) => entry.id === session.wizard.selectedScenarioId) ??
    null;
  const selectedVariant = resolveSelectedScenarioVariant(scenario);

  if (step === 'approval') {
    return (
      <article className={styles.card}>
        <h2 className={styles.sectionTitle}>Angebot – Freigabe</h2>
        {scenario?.approval?.adminReviewRequired ? (
          <div className={styles.error}>
            <p>{APPROVAL_DEVIATION_FIELD_MESSAGE}</p>
            <StatusBadge variant="warning" label={APPROVAL_WAITING_STATUS_LABEL} />
          </div>
        ) : null}
        {workflowView ? (
          <dl className={styles.formGrid}>
            <div>
              <dt>Freigabe erforderlich</dt>
              <dd>{workflowView.approvalRequired ? 'Ja' : 'Nein'}</dd>
            </div>
            <div>
              <dt>Freigegeben</dt>
              <dd>{workflowView.approved ? 'Ja' : 'Nein'}</dd>
            </div>
          </dl>
        ) : null}
        <div className={formFieldStyles.field}>
          <label htmlFor="approvalNotes">Hinweise zur Freigabe (optional)</label>
          <textarea
            id="approvalNotes"
            className={textareaClassName()}
            value={approvalNotes}
            disabled={busy}
            onChange={(event) => onApprovalNotesChange(event.target.value)}
          />
        </div>
        <div className={styles.actions}>
          <Button loading={busy} onClick={onSubmitApproval}>
            Freigabe anfordern
          </Button>
          {session.offerId ? (
            <Link className={styles.choiceButton} to={offerWorkflowTabPath(session.offerId)}>
              Freigabe & Versand öffnen
            </Link>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <div className={styles.stack}>
      <article className={styles.hero}>
        <h2 className={styles.sectionTitle}>Angebot</h2>
        <p className={styles.hint}>Transparente Kosten und Standardabweichungen.</p>
        {selectedVariant ? (
          <dl className={styles.formGrid}>
            <div>
              <dt>Variante</dt>
              <dd>{selectedVariant.tariffName}</dd>
            </div>
            <div>
              <dt>Hardware</dt>
              <dd>{selectedVariant.productName ?? '—'}</dd>
            </div>
            <div>
              <dt>Laufzeit</dt>
              <dd>{selectedVariant.termMonths ?? '—'} Monate</dd>
            </div>
            <div>
              <dt>BestPay monatlich</dt>
              <dd>{formatEuro(selectedVariant.monthlyTotalCostsCents)}</dd>
            </div>
            {canSeeCommission ? (
              <div>
                <dt>Provision (intern)</dt>
                <dd>{formatEuro(selectedVariant.commissionTotalCents)}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className={styles.hint}>Bitte zuerst eine Empfehlung wählen.</p>
        )}
        {!session.leadId ? (
          <p className={styles.hint}>
            Bitte zuerst einen Kunden zuordnen, bevor ein Angebotsentwurf erzeugt wird.
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button
            loading={busy}
            disabled={!selectedVariant || !session.leadId}
            onClick={onCreateOffer}
          >
            Angebotsentwurf erzeugen
          </Button>
          {session.offerId ? (
            <>
              <Link className={styles.choiceButton} to={`/offers/${session.offerId}`}>
                Entwurf öffnen
              </Link>
              <Link className={styles.choiceButton} to={offerWorkflowTabPath(session.offerId)}>
                Freigabe & Versand öffnen
              </Link>
            </>
          ) : null}
          <Button variant="text" onClick={onBackToRecommendation}>
            Zurück zur Empfehlung
          </Button>
        </div>
        {session.offerNumber ? (
          <p className={styles.hint}>
            Angebot {session.offerNumber}
            {session.offerTitle ? ` – ${session.offerTitle}` : ''}
          </p>
        ) : null}
      </article>
    </div>
  );
}
