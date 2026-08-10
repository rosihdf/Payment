import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buildOfferCustomerHandoffChecklist,
  getOfferCustomerTemplateStatusLabel,
} from '../../domain/offer/offerCustomerHandoffLabels';
import type { OfferCustomerCommunicationHandoff } from '../../domain/offer/offerCustomerCommunicationHandoff';
import type { Offer } from '../../domain/offer/offer';
import { useServices } from '../../hooks/useServices';
import type { OfferUserContext } from '../../services/offerService';
import { buildOfferReviewUrl } from '../../services/offerShareService';
import { formatDateTime } from '../../utils/format';
import styles from './OfferCustomerShareSection.module.css';

interface OfferCustomerShareSectionProps {
  offer: Offer;
  userContext: OfferUserContext;
  onUpdated?: () => void;
}

export function OfferCustomerShareSection({
  offer,
  userContext,
  onUpdated,
}: OfferCustomerShareSectionProps) {
  const { offerWorkflowService, offerShareService } = useServices();
  const [handoff, setHandoff] = useState<OfferCustomerCommunicationHandoff | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deliveryRecipient, setDeliveryRecipient] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const nextHandoff = await offerWorkflowService.evaluateCustomerCommunicationHandoff(
      offer.id,
      revealedToken ? buildOfferReviewUrl(revealedToken) : null,
    );
    setHandoff(nextHandoff);
    setLoading(false);
  }, [offer.id, offerWorkflowService, revealedToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const checklist = handoff ? buildOfferCustomerHandoffChecklist(handoff.readiness) : [];
  const statusLabel = getOfferCustomerTemplateStatusLabel(offer.workflowStatus);
  const pdfPath = handoff?.documentId
    ? `/offers/${offer.id}/documents/${handoff.documentId}`
    : `/offers/${offer.id}/preview`;

  const handleCreateLink = async () => {
    if (!handoff?.readiness) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await offerShareService.createCustomerShareLink(
        offer.id,
        userContext,
        handoff.readiness,
      );
      if (!result.ok) {
        setMessage(result.blockers?.[0] ?? 'Kundenlink konnte nicht erstellt werden.');
        return;
      }
      setRevealedToken(result.token);
      setMessage(
        'Kundenlink erstellt. Es wurde noch keine Übergabe dokumentiert und nichts versendet.',
      );
      onUpdated?.();
    } finally {
      setBusy(false);
      await load();
    }
  };

  const handleMarkDelivered = async (channel: 'manual' | 'share_link') => {
    if (!handoff?.offerVersionId) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await offerWorkflowService.markOfferDeliveredToCustomer(offer.id, userContext, {
        offerVersionId: handoff.offerVersionId,
        documentId: handoff.documentId,
        channel,
        recipient: deliveryRecipient.trim(),
        shareLinkId: channel === 'share_link' ? handoff.shareLinkId : null,
      });
      if (!result.ok) {
        setMessage('Übergabe konnte nicht dokumentiert werden.');
        return;
      }
      setMessage(
        result.duplicate
          ? 'Übergabe war bereits dokumentiert.'
          : 'Übergabe an den Kunden dokumentiert.',
      );
      onUpdated?.();
    } finally {
      setBusy(false);
      setDeliveryRecipient('');
      await load();
    }
  };

  const handleCopy = async () => {
    if (!revealedToken) return;
    await navigator.clipboard.writeText(buildOfferReviewUrl(revealedToken));
    setMessage('Kundenlink in die Zwischenablage kopiert.');
  };

  if (loading) {
    return <p className={styles.hint}>Kundenvorlage wird geladen…</p>;
  }

  return (
    <section className={styles.section} aria-labelledby="offer-customer-share-title">
      <div className={styles.header}>
        <div>
          <h2 id="offer-customer-share-title" className={styles.title}>
            Kundenvorlage
          </h2>
          <p className={styles.subtitle}>
            Link-Erstellung und dokumentierte Übergabe sind getrennte Schritte. Es gibt noch keinen
            E-Mail- oder WhatsApp-Versand.
          </p>
        </div>
      </div>

      <p className={styles.message} role="status">
        Status: {statusLabel}
      </p>

      {!handoff?.readiness.allowed ? (
        <div className={styles.blocker} role="status">
          <p>Noch nicht bereit zur Kundenvorlage.</p>
          <ul>
            {checklist.map((item) => (
              <li key={item.id}>
                {item.satisfied ? '✓' : '○'} {item.label}
              </li>
            ))}
          </ul>
          {handoff?.primaryBlockerMessage ? (
            <p>{handoff.primaryBlockerMessage}</p>
          ) : null}
        </div>
      ) : (
        <p className={styles.message}>Bereit zur Kundenvorlage</p>
      )}

      {handoff?.stage === 'document_sent' || offer.workflowStatus === 'sent' ? (
        <dl className={styles.meta}>
          <div>
            <dt>Übergabe dokumentiert</dt>
            <dd>{handoff?.lastDeliveryAt ? formatDateTime(handoff.lastDeliveryAt) : '–'}</dd>
          </div>
          <div>
            <dt>Kanal</dt>
            <dd>{handoff?.lastDeliveryChannel ?? '–'}</dd>
          </div>
          <div>
            <dt>Empfänger</dt>
            <dd>{handoff?.lastDeliveryRecipient || '–'}</dd>
          </div>
          <div>
            <dt>Dokument</dt>
            <dd>{handoff?.documentDisplayName ?? '–'}</dd>
          </div>
        </dl>
      ) : null}

      {offer.workflowStatus === 'accepted' ? (
        <p className={styles.message}>Entscheidung: angenommen</p>
      ) : null}
      {offer.workflowStatus === 'declined' ? (
        <p className={styles.message}>Entscheidung: abgelehnt</p>
      ) : null}

      {message ? <p className={styles.message} role="status">{message}</p> : null}

      {handoff?.shareLinkId ? (
        <dl className={styles.meta}>
          <div>
            <dt>Link gültig bis</dt>
            <dd>{handoff.validUntil ? formatDateTime(handoff.validUntil) : '–'}</dd>
          </div>
        </dl>
      ) : null}

      <div className={styles.actions}>
        <Link to={pdfPath} className={styles.secondaryAction}>
          PDF anzeigen
        </Link>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={busy || !handoff?.canCreateShareLink}
          onClick={() => void handleCreateLink()}
        >
          Kundenlink erstellen
        </button>
        {revealedToken ? (
          <button type="button" className={styles.secondaryAction} onClick={() => void handleCopy()}>
            Kundenlink kopieren
          </button>
        ) : null}
        <button
          type="button"
          className={styles.secondaryAction}
          disabled={busy || !handoff?.canRecordDocumentSent || offer.workflowStatus === 'sent'}
          onClick={() => void handleMarkDelivered(handoff?.shareLinkId ? 'share_link' : 'manual')}
        >
          Übergabe dokumentieren
        </button>
      </div>

      {handoff?.canRecordDocumentSent && offer.workflowStatus !== 'sent' ? (
        <label className={styles.hint}>
          Empfänger optional
          <input
            type="text"
            value={deliveryRecipient}
            onChange={(event) => setDeliveryRecipient(event.target.value)}
            placeholder="z. B. Name oder Kanalhinweis"
          />
        </label>
      ) : null}
    </section>
  );
}
