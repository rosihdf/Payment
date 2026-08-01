import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormField } from '../../components/common/FormField';
import {
  COUNSELING_PRINCIPLE_KEYS,
  COUNSELING_PRINCIPLE_LABELS,
  emptyCounselingPrincipleFlags,
  type CounselingPrincipleFlags,
} from '../../domain/offer/counselingConfirmation';
import type { Offer } from '../../domain/offer/offer';
import type { OfferVersion } from '../../domain/offer/offerVersion';
import type { OfferWorkflowEvent } from '../../domain/offer/offerWorkflowEvents';
import {
  OFFER_WORKFLOW_STATUS_LABELS,
  type OfferWorkflowStatus,
} from '../../domain/offer/offerWorkflow';
import type { SalesDocument } from '../../domain/salesDocument/salesDocument';
import { SALES_DOCUMENT_TYPE_LABELS } from '../../domain/salesDocument/salesDocument';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { displayDateTime } from '../../utils/format';
import { OfferWorkflowStatusBadge } from './OfferWorkflowStatusBadge';
import styles from './OfferWorkflowSection.module.css';

type WorkflowDialog =
  | 'submit_approval'
  | 'approve'
  | 'request_changes'
  | 'send'
  | 'accept'
  | 'decline'
  | null;

function eventLabel(event: OfferWorkflowEvent): string {
  switch (event.type) {
    case 'approval':
      return event.status === 'approved'
        ? 'Freigegeben'
        : event.status === 'changes_requested'
          ? 'Änderungen angefordert'
          : 'Freigabe beantragt';
    case 'dispatch':
      return 'Versendet';
    case 'acceptance':
      return 'Angenommen';
    case 'decline':
      return 'Abgelehnt';
    case 'activation':
      return event.status === 'prepared'
        ? 'Historische Aktivierungsvorbereitung'
        : 'Historische Angebotsaktivierung';
    case 'counseling_confirmation':
      return 'Beratungsgrundsätze bestätigt';
    case 'follow_up_preferences':
      return 'Bedenkzeit / Nachfassen';
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

interface OfferWorkflowSectionProps {
  offer: Offer;
  onUpdated: () => Promise<void>;
  /** actions = Freigabe/Versand; versions = Versionen & Verlauf; full = beides (Legacy). */
  mode?: 'actions' | 'versions' | 'full';
  hideHeaderBadge?: boolean;
  hideNextActionBanner?: boolean;
}

export function OfferWorkflowSection({
  offer,
  onUpdated,
  mode = 'full',
  hideHeaderBadge = false,
  hideNextActionBanner = false,
}: OfferWorkflowSectionProps) {
  const { currentUser } = useCurrentUser();
  const { offerWorkflowService } = useServices();
  const { showToast } = useToast();

  const [versions, setVersions] = useState<OfferVersion[]>([]);
  const [events, setEvents] = useState<OfferWorkflowEvent[]>([]);
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [diffEntries, setDiffEntries] = useState<
    Array<{ field: string; label: string; before: string; after: string; approvalRelevant: boolean }>
  >([]);
  const [dialog, setDialog] = useState<WorkflowDialog>(null);
  const [note, setNote] = useState('');
  const [recipient, setRecipient] = useState('');
  const [acceptedByName, setAcceptedByName] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [counselingFlags, setCounselingFlags] = useState<CounselingPrincipleFlags>(
    emptyCounselingPrincipleFlags(),
  );
  const [followUpDate, setFollowUpDate] = useState('');
  const [comparesOffers, setComparesOffers] = useState(false);
  const [openQuestions, setOpenQuestions] = useState('');
  const [customerContactsSelf, setCustomerContactsSelf] = useState(false);
  const [noFollowUpDesired, setNoFollowUpDesired] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const userContext = useMemo(
    () =>
      currentUser
        ? { userId: currentUser.id, role: currentUser.role, displayName: currentUser.name }
        : null,
    [currentUser],
  );

  const loadWorkflow = useCallback(async () => {
    const summary = await offerWorkflowService.getWorkflowSummary(offer.id);
    setVersions(await offerWorkflowService.getVersions(offer.id));
    setEvents(summary.events);
    setDocuments(summary.documents);
  }, [offer.id, offerWorkflowService]);

  useEffect(() => {
    void loadWorkflow();
  }, [loadWorkflow, offer.workflowStatus, offer.currentVersionId]);

  useEffect(() => {
    if (!compareVersionId || !offer.currentVersionId) {
      setDiffEntries([]);
      return;
    }
    void offerWorkflowService
      .compareVersions(compareVersionId, offer.currentVersionId)
      .then(setDiffEntries);
  }, [compareVersionId, offer.currentVersionId, offerWorkflowService]);

  const currentVersion = versions.find((version) => version.id === offer.currentVersionId) ?? null;
  const canApprove =
    userContext &&
    (userContext.role === 'admin' || offer.createdByUserId !== userContext.userId);

  const closeDialog = () => {
    setDialog(null);
    setNote('');
    setRecipient('');
    setAcceptedByName('');
    setDeclineReason('');
    setCounselingFlags(emptyCounselingPrincipleFlags());
    setFollowUpDate('');
    setComparesOffers(false);
    setOpenQuestions('');
    setCustomerContactsSelf(false);
    setNoFollowUpDesired(false);
  };

  const runAction = async (action: () => Promise<{ ok: boolean }>) => {
    if (!userContext) {
      return;
    }
    setIsRunning(true);
    const result = await action();
    if (result.ok) {
      showToast('Workflow aktualisiert', 'success');
      await onUpdated();
      await loadWorkflow();
      closeDialog();
    } else {
      showToast('Aktion nicht möglich', 'error');
    }
    setIsRunning(false);
  };

  const nextAction = (status: OfferWorkflowStatus): string => {
    switch (status) {
      case 'draft':
        return 'Freigabe anfordern oder versandbereit markieren';
      case 'approval_required':
      case 'in_approval':
        return 'Freigabe prüfen';
      case 'changes_requested':
        return 'Neue Version erstellen und bearbeiten';
      case 'approved':
        return 'Als versandbereit markieren';
      case 'ready_to_send':
        return 'Versand dokumentieren';
      case 'sent':
        return 'Annahme oder Ablehnung dokumentieren';
      case 'accepted':
      case 'activation_pending':
      case 'activated':
        return 'Weiter in der Kundenakte oder über Vertrag & Aktivierung';
      default:
        return 'Status prüfen';
    }
  };

  const showActions = mode === 'actions' || mode === 'full';
  const showVersions = mode === 'versions' || mode === 'full';
  const title =
    mode === 'actions' ? 'Freigabe & Versand' : mode === 'versions' ? 'Versionen & Verlauf' : 'Angebotsworkflow';

  return (
    <section className={styles.section} aria-labelledby="offer-workflow-title">
      <div className={styles.header}>
        <div>
          <h2 id="offer-workflow-title" className={styles.title}>
            {title}
          </h2>
          <p className={styles.subtitle}>
            Version {offer.currentVersionNumber}
            {offer.validUntil ? ` · Gültig bis ${displayDateTime(offer.validUntil)}` : ''}
          </p>
        </div>
        {hideHeaderBadge ? null : <OfferWorkflowStatusBadge status={offer.workflowStatus} />}
      </div>

      {hideNextActionBanner || !showActions ? null : (
        <p className={styles.nextAction}>
          <strong>Nächste Aktion:</strong> {nextAction(offer.workflowStatus)}
        </p>
      )}

      {showActions ? (
      <div className={styles.actions}>
        {offer.workflowStatus === 'draft' ? (
          <button
            type="button"
            className={styles.primaryAction}
            disabled={isRunning}
            onClick={() => setDialog('submit_approval')}
          >
            Freigabe anfordern
          </button>
        ) : null}
        {['approval_required', 'in_approval'].includes(offer.workflowStatus) && canApprove ? (
          <>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isRunning}
              onClick={() => setDialog('approve')}
            >
              Freigeben
            </button>
            <button
              type="button"
              className={styles.secondaryAction}
              disabled={isRunning}
              onClick={() => setDialog('request_changes')}
            >
              Änderungen anfordern
            </button>
          </>
        ) : null}
        {offer.workflowStatus === 'approved' ? (
          <button
            type="button"
            className={styles.primaryAction}
            disabled={isRunning}
            onClick={() =>
              userContext &&
              void runAction(() => offerWorkflowService.markReadyToSend(offer.id, userContext))
            }
          >
            Versandbereit
          </button>
        ) : null}
        {offer.workflowStatus === 'ready_to_send' ? (
          <button
            type="button"
            className={styles.primaryAction}
            disabled={isRunning}
            onClick={() => setDialog('send')}
          >
            Als versendet dokumentieren
          </button>
        ) : null}
        {offer.workflowStatus === 'sent' ? (
          <>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isRunning}
              onClick={() => setDialog('accept')}
            >
              Annahme dokumentieren
            </button>
            <button
              type="button"
              className={styles.secondaryAction}
              disabled={isRunning}
              onClick={() => setDialog('decline')}
            >
              Ablehnung dokumentieren
            </button>
          </>
        ) : null}
      </div>
      ) : null}

      {showActions && dialog === 'submit_approval' ? (
        <section className={styles.formPanel}>
          <FormField id="approval-note" label="Notiz zur Freigabe">
            <textarea
              id="approval-note"
              className={styles.textarea}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryAction} onClick={closeDialog}>
              Abbrechen
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isRunning}
              onClick={() =>
                userContext &&
                void runAction(() =>
                  offerWorkflowService.submitForApproval(offer.id, userContext, note),
                )
              }
            >
              Freigabe anfordern
            </button>
          </div>
        </section>
      ) : null}

      {showActions && dialog === 'approve' ? (
        <section className={styles.formPanel}>
          <FormField id="approve-note" label="Freigabe-Kommentar">
            <textarea
              id="approve-note"
              className={styles.textarea}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryAction} onClick={closeDialog}>
              Abbrechen
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isRunning}
              onClick={() =>
                userContext &&
                void runAction(() => offerWorkflowService.approve(offer.id, userContext, note))
              }
            >
              Freigeben
            </button>
          </div>
        </section>
      ) : null}

      {showActions && dialog === 'request_changes' ? (
        <section className={styles.formPanel}>
          <FormField id="changes-note" label="Änderungsanforderung">
            <textarea
              id="changes-note"
              className={styles.textarea}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryAction} onClick={closeDialog}>
              Abbrechen
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isRunning}
              onClick={() =>
                userContext &&
                void runAction(() =>
                  offerWorkflowService.requestChanges(offer.id, userContext, note),
                )
              }
            >
              Änderungen anfordern
            </button>
          </div>
        </section>
      ) : null}

      {showActions && dialog === 'send' ? (
        <section className={styles.formPanel}>
          <fieldset>
            <legend>Beratungsgrundsätze</legend>
            <ul className={styles.checklist}>
              {COUNSELING_PRINCIPLE_KEYS.map((key) => (
                <li key={key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={counselingFlags[key]}
                      onChange={(event) =>
                        setCounselingFlags((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    {COUNSELING_PRINCIPLE_LABELS[key]}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <FormField id="dispatch-recipient" label="Empfänger">
            <input
              id="dispatch-recipient"
              className={styles.input}
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="kunde@example.test"
            />
          </FormField>
          <fieldset>
            <legend>Bedenkzeit / Nachfassen</legend>
            <FormField id="follow-up-date" label="Nachfassdatum">
              <input
                id="follow-up-date"
                type="date"
                className={styles.input}
                value={followUpDate}
                disabled={noFollowUpDesired}
                onChange={(event) => setFollowUpDate(event.target.value)}
              />
            </FormField>
            <label>
              <input
                type="checkbox"
                checked={comparesOffers}
                onChange={(event) => setComparesOffers(event.target.checked)}
              />
              Kunde vergleicht Angebote
            </label>
            <label>
              <input
                type="checkbox"
                checked={customerContactsSelf}
                onChange={(event) => setCustomerContactsSelf(event.target.checked)}
              />
              Kunde meldet sich selbst
            </label>
            <label>
              <input
                type="checkbox"
                checked={noFollowUpDesired}
                onChange={(event) => setNoFollowUpDesired(event.target.checked)}
              />
              Kein Nachfassen gewünscht
            </label>
            <FormField id="open-questions" label="Offene Fragen">
              <textarea
                id="open-questions"
                className={styles.textarea}
                value={openQuestions}
                onChange={(event) => setOpenQuestions(event.target.value)}
              />
            </FormField>
          </fieldset>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryAction} onClick={closeDialog}>
              Abbrechen
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isRunning}
              onClick={() =>
                userContext &&
                currentVersion &&
                void runAction(async () => {
                  const confirmResult = await offerWorkflowService.confirmCounselingPrinciples(
                    offer.id,
                    currentVersion.id,
                    userContext,
                    counselingFlags,
                  );
                  if (!confirmResult.ok) {
                    return confirmResult;
                  }
                  const providedAt = new Date().toISOString();
                  return offerWorkflowService.documentSent(
                    offer.id,
                    userContext,
                    recipient,
                    'email',
                    {
                      providedAt,
                      followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
                      comparesOffers,
                      openQuestions,
                      customerContactsSelf,
                      noFollowUpDesired,
                    },
                  );
                })
              }
            >
              Versand speichern
            </button>
          </div>
        </section>
      ) : null}

      {showActions && dialog === 'accept' ? (
        <section className={styles.formPanel}>
          <FormField id="accepted-by" label="Annehmende Person">
            <input
              id="accepted-by"
              className={styles.input}
              value={acceptedByName}
              onChange={(event) => setAcceptedByName(event.target.value)}
            />
          </FormField>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryAction} onClick={closeDialog}>
              Abbrechen
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isRunning}
              onClick={() =>
                userContext &&
                void runAction(() =>
                  offerWorkflowService.acceptOffer(offer.id, userContext, acceptedByName),
                )
              }
            >
              Annahme speichern
            </button>
          </div>
        </section>
      ) : null}

      {showActions && dialog === 'decline' ? (
        <section className={styles.formPanel}>
          <FormField id="decline-reason" label="Ablehnungsgrund">
            <textarea
              id="decline-reason"
              className={styles.textarea}
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
            />
          </FormField>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryAction} onClick={closeDialog}>
              Abbrechen
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isRunning}
              onClick={() =>
                userContext &&
                void runAction(() =>
                  offerWorkflowService.declineOffer(offer.id, userContext, declineReason),
                )
              }
            >
              Ablehnung speichern
            </button>
          </div>
        </section>
      ) : null}

      {showVersions ? (
      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="workflow-status-history">
          <h3 id="workflow-status-history" className={styles.panelTitle}>
            Statusverlauf
          </h3>
          <ol className={styles.timeline}>
            {events.length === 0 ? (
              <li className={styles.timelineItem}>Noch keine Workflow-Ereignisse</li>
            ) : (
              events.map((event) => (
                <li key={event.id} className={styles.timelineItem}>
                  <span className={styles.timelineTitle}>{eventLabel(event)}</span>
                  <span className={styles.timelineMeta}>
                    {displayDateTime(event.createdAt)} · {event.createdByDisplayName}
                  </span>
                </li>
              ))
            )}
          </ol>
        </section>

        <section className={styles.panel} aria-labelledby="workflow-versions">
          <h3 id="workflow-versions" className={styles.panelTitle}>
            Versionen
          </h3>
          <ul className={styles.versionList}>
            {versions.map((version) => (
              <li key={version.id} className={styles.versionItem}>
                <div>
                  <strong>Version {version.versionNumber}</strong>
                  <span className={styles.versionMeta}>
                    {OFFER_WORKFLOW_STATUS_LABELS[version.workflowStatus]} ·{' '}
                    {displayDateTime(version.createdAt)}
                  </span>
                </div>
                {offer.currentVersionId !== version.id ? (
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() =>
                      setCompareVersionId(compareVersionId === version.id ? null : version.id)
                    }
                  >
                    {compareVersionId === version.id ? 'Vergleich schließen' : 'Unterschiede anzeigen'}
                  </button>
                ) : (
                  <span className={styles.currentVersion}>Aktuell</span>
                )}
              </li>
            ))}
          </ul>
          {diffEntries.length > 0 ? (
            <table className={styles.diffTable}>
              <caption>Unterschiede zur aktuellen Version</caption>
              <thead>
                <tr>
                  <th scope="col">Feld</th>
                  <th scope="col">Vorher</th>
                  <th scope="col">Nachher</th>
                </tr>
              </thead>
              <tbody>
                {diffEntries.map((entry) => (
                  <tr key={entry.field}>
                    <td>
                      {entry.label}
                      {entry.approvalRelevant ? ' (freigaberelevant)' : ''}
                    </td>
                    <td>{entry.before}</td>
                    <td>{entry.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section className={styles.panel} aria-labelledby="workflow-documents">
          <h3 id="workflow-documents" className={styles.panelTitle}>
            Dokumente
          </h3>
          {documents.length === 0 ? (
            <p className={styles.empty}>Keine Dokumentmetadaten hinterlegt.</p>
          ) : (
            <ul className={styles.documentList}>
              {documents.map((document) => (
                <li key={document.id}>
                  <strong>{SALES_DOCUMENT_TYPE_LABELS[document.type]}</strong>
                  <span>
                    {document.fileName} · {displayDateTime(document.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      ) : null}

      {showVersions && currentVersion ? (
        <p className={styles.snapshotHint}>
          Angezeigte Konditionen entsprechen Version {currentVersion.versionNumber} (Snapshot vom{' '}
          {displayDateTime(currentVersion.createdAt)}).
        </p>
      ) : null}
    </section>
  );
}
