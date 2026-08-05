import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BestPayComparisonSession } from '../../../domain/bestPayComparison/bestPayComparisonSession';
import { resolveSelectedScenarioVariant } from '../../../domain/bestPayComparison/salesWizard';
import { getSessionCustomerDisplayName } from '../../../domain/lead/getLeadDisplayName';
import type { Offer } from '../../../domain/offer/offer';
import type { OfferPublicationReadiness } from '../../../domain/offer/offerPublicationReadiness';
import type { OfferVersion } from '../../../domain/offer/offerVersion';
import { OFFER_WORKFLOW_STATUS_LABELS } from '../../../domain/offer/offerWorkflow';
import type { OfferShare } from '../../../domain/offer/offerShare';
import { SHARE_STATUS_LABELS } from '../../../domain/offer/offerShare';
import type { OfferUserContext } from '../../../services/offerService';
import type { OfferShareService } from '../../../services/offerShareService';
import { buildOfferReviewUrl } from '../../../services/offerShareService';
import type { OfferWorkflowService } from '../../../services/offerWorkflowService';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { textareaClassName, formControlClassName } from '../../ui/FormField';
import formFieldStyles from '../../ui/FormField.module.css';
import { StatusBadge } from '../../ui/StatusBadge';
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
  userContext: OfferUserContext;
  offerShareService: OfferShareService;
  offerWorkflowService: OfferWorkflowService;
  followUpNote: string;
  onFollowUpNoteChange: (value: string) => void;
  onComplete: () => void;
  onWorkflowUpdated: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

type HandoffDialog = 'documentSent' | 'acceptOffer' | null;

export function ClosingStep({
  session,
  busy,
  canSeeCommission,
  workflowView,
  userContext,
  offerShareService,
  offerWorkflowService,
  followUpNote,
  onFollowUpNoteChange,
  onComplete,
  onWorkflowUpdated,
  showToast,
}: ClosingStepProps) {
  const scenario =
    session.wizard.scenarios.find((entry) => entry.id === session.wizard.selectedScenarioId) ??
    null;
  const selectedVariant = resolveSelectedScenarioVariant(scenario);
  const workflowStatus = workflowView?.workflowStatus ?? null;

  const [readiness, setReadiness] = useState<OfferPublicationReadiness | null>(null);
  const [activeShare, setActiveShare] = useState<OfferShare | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [handoffDialog, setHandoffDialog] = useState<HandoffDialog>(null);
  const [handoffRecipient, setHandoffRecipient] = useState('');
  const [acceptedByName, setAcceptedByName] = useState('');
  const [handoffBusy, setHandoffBusy] = useState(false);

  const loadShareState = useCallback(async () => {
    if (!session.offerId) {
      return;
    }
    setShareLoading(true);
    const [nextReadiness, share] = await Promise.all([
      offerWorkflowService.evaluatePublicationReadiness(session.offerId),
      offerShareService.getActiveShareByOfferId(session.offerId),
    ]);
    setReadiness(nextReadiness);
    setActiveShare(share);
    setShareLoading(false);
  }, [offerShareService, offerWorkflowService, session.offerId]);

  useEffect(() => {
    void loadShareState();
  }, [loadShareState]);

  const handleCreateShareLink = async () => {
    if (!session.offerId) {
      return;
    }
    setShareMessage(null);
    setShareLoading(true);
    const result = await offerShareService.createCustomerShareLink(
      session.offerId,
      userContext,
      readiness,
    );
    setShareLoading(false);
    if (!result.ok) {
      setShareMessage(result.blockers?.[0] ?? 'Kundenlink konnte nicht erstellt werden.');
      return;
    }
    setRevealedToken(result.token);
    setActiveShare(result.share);
    setShareMessage('Link erstellt. Kopieren Sie ihn jetzt – er wird nur einmal angezeigt.');
  };

  const handleCopyShareLink = async () => {
    if (!revealedToken) {
      return;
    }
    await navigator.clipboard.writeText(buildOfferReviewUrl(revealedToken));
    setShareMessage('Link in die Zwischenablage kopiert.');
    showToast('Link kopiert', 'success');
  };

  const handleDocumentSent = async () => {
    if (!session.offerId) {
      return;
    }
    setHandoffBusy(true);
    const result = await offerWorkflowService.documentSent(
      session.offerId,
      userContext,
      handoffRecipient.trim(),
      'manual',
    );
    setHandoffBusy(false);
    if (!result.ok) {
      showToast('Versand konnte nicht dokumentiert werden.', 'error');
      return;
    }
    showToast('Versand dokumentiert', 'success');
    setHandoffDialog(null);
    setHandoffRecipient('');
    onWorkflowUpdated();
  };

  const handleAcceptOffer = async () => {
    if (!session.offerId || !acceptedByName.trim()) {
      return;
    }
    setHandoffBusy(true);
    const result = await offerWorkflowService.acceptOffer(
      session.offerId,
      userContext,
      acceptedByName.trim(),
    );
    setHandoffBusy(false);
    if (!result.ok) {
      showToast('Annahme konnte nicht dokumentiert werden.', 'error');
      return;
    }
    showToast('Annahme dokumentiert', 'success');
    setHandoffDialog(null);
    setAcceptedByName('');
    onWorkflowUpdated();
  };

  const canDocumentSent = workflowStatus === 'ready_to_send';
  const canAcceptOffer = workflowStatus === 'sent';

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
              <dd>
                {workflowView.workflowStatus
                  ? OFFER_WORKFLOW_STATUS_LABELS[workflowView.workflowStatus] ??
                    workflowView.workflowStatus
                  : '—'}
              </dd>
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
      </article>

      {session.offerId ? (
        <article className={styles.card}>
          <h3 className={styles.sectionTitle}>Kundenlink</h3>
          <p className={styles.hint}>
            Sicherer Link zur Angebotsprüfung – ohne Login, 30 Tage gültig.
          </p>
          {!readiness?.publicationAllowed ? (
            <p className={styles.hint} role="status">
              Kundenvorlage noch nicht möglich:{' '}
              {readiness?.blockers[0] ?? 'Freigabe ausstehend.'}
            </p>
          ) : null}
          {shareMessage ? (
            <p className={styles.hint} role="status">
              {shareMessage}
            </p>
          ) : null}
          {activeShare ? (
            <p className={styles.hint}>
              Aktiver Link · Status:{' '}
              {SHARE_STATUS_LABELS[offerShareService.resolveShareStatus(activeShare)]}
            </p>
          ) : null}
          <div className={styles.actions}>
            <Button
              loading={shareLoading}
              disabled={!readiness?.publicationAllowed}
              onClick={() => void handleCreateShareLink()}
            >
              {activeShare ? 'Link neu erzeugen' : 'Kundenlink erstellen'}
            </Button>
            {revealedToken ? (
              <Button variant="secondary" onClick={() => void handleCopyShareLink()}>
                Link kopieren
              </Button>
            ) : null}
          </div>
        </article>
      ) : null}

      <article className={styles.card}>
        <h3 className={styles.sectionTitle}>Externer BestPay-Abschluss</h3>
        <p className={styles.hint}>
          Der Vertragsabschluss erfolgt extern bei BestPay. Dokumentieren Sie hier Versand und
          Annahme für die Nachverfolgung – ohne zusätzliche Freigabelogik.
        </p>
        {workflowStatus ? (
          <StatusBadge
            variant="info"
            label={OFFER_WORKFLOW_STATUS_LABELS[workflowStatus] ?? workflowStatus}
          />
        ) : null}
        <div className={styles.actions}>
          {canDocumentSent ? (
            <Button variant="secondary" onClick={() => setHandoffDialog('documentSent')}>
              Versand dokumentieren
            </Button>
          ) : null}
          {canAcceptOffer ? (
            <Button variant="secondary" onClick={() => setHandoffDialog('acceptOffer')}>
              Annahme dokumentieren
            </Button>
          ) : null}
        </div>
      </article>

      <article className={styles.card}>
        <div className={formFieldStyles.field}>
          <label htmlFor="followUpNote">Wiedervorlage / Notiz</label>
          <textarea
            id="followUpNote"
            className={textareaClassName()}
            value={followUpNote}
            disabled={busy}
            onChange={(event) => onFollowUpNoteChange(event.target.value)}
            placeholder="Interne Notiz für Nachfassen oder Handoff…"
          />
        </div>
      </article>

      <div className={styles.actions}>
        {!session.wizard.wizardCompletedAt ? (
          <Button loading={busy} onClick={onComplete}>
            Beratung abschließen
          </Button>
        ) : null}
        {session.offerId ? (
          <>
            <Link className={styles.choiceButton} to={`/offers/${session.offerId}`}>
              Angebot öffnen
            </Link>
            <Link className={styles.choiceButton} to={`/offers/${session.offerId}/preview`}>
              PDF-Vorschau
            </Link>
          </>
        ) : null}
        {session.leadId ? (
          <Link className={styles.choiceButton} to={`/leads/${session.leadId}`}>
            Kundenakte
          </Link>
        ) : null}
        <Link className={styles.choiceButton} to={ADVICE_PATH}>
          Beratung
        </Link>
      </div>

      <Dialog
        isOpen={handoffDialog === 'documentSent'}
        title="Versand dokumentieren"
        onClose={() => setHandoffDialog(null)}
        secondaryAction={{
          label: 'Abbrechen',
          onClick: () => setHandoffDialog(null),
        }}
        primaryAction={{
          label: 'Speichern',
          loading: handoffBusy,
          onClick: () => void handleDocumentSent(),
        }}
      >
        <p className={styles.hint}>
          Dokumentiert, dass das Angebot an den Kunden übergeben wurde (z. B. per E-Mail oder
          persönlich).
        </p>
        <div className={formFieldStyles.field}>
          <label htmlFor="handoffRecipient">Empfänger (optional)</label>
          <input
            id="handoffRecipient"
            type="text"
            className={formControlClassName()}
            value={handoffRecipient}
            onChange={(event) => setHandoffRecipient(event.target.value)}
            placeholder="E-Mail oder Name"
          />
        </div>
      </Dialog>

      <Dialog
        isOpen={handoffDialog === 'acceptOffer'}
        title="Annahme dokumentieren"
        onClose={() => setHandoffDialog(null)}
        secondaryAction={{
          label: 'Abbrechen',
          onClick: () => setHandoffDialog(null),
        }}
        primaryAction={{
          label: 'Speichern',
          loading: handoffBusy,
          disabled: !acceptedByName.trim(),
          onClick: () => void handleAcceptOffer(),
        }}
      >
        <p className={styles.hint}>
          Dokumentiert die Kundenannahme vor dem externen BestPay-Abschluss.
        </p>
        <div className={formFieldStyles.field}>
          <label htmlFor="acceptedByName">Annehmende Person</label>
          <input
            id="acceptedByName"
            type="text"
            className={formControlClassName()}
            value={acceptedByName}
            onChange={(event) => setAcceptedByName(event.target.value)}
            placeholder="Name des Kunden oder Ansprechpartners"
          />
        </div>
      </Dialog>
    </div>
  );
}
