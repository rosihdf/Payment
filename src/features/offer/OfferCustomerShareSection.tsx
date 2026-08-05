import { useCallback, useEffect, useState } from 'react';
import type { Offer } from '../../domain/offer/offer';
import type { OfferPublicationReadiness } from '../../domain/offer/offerPublicationReadiness';
import type { OfferShare } from '../../domain/offer/offerShare';
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

function customerFacingStatus(input: {
  readiness: OfferPublicationReadiness | null;
  share: OfferShare | null;
  offer: Offer;
  hasOpenQuestion: boolean;
}): string {
  const { readiness, share, offer, hasOpenQuestion } = input;
  if (offer.workflowStatus === 'accepted') return 'Angenommen';
  if (offer.workflowStatus === 'declined') return 'Abgelehnt';
  if (offer.workflowStatus === 'changes_requested') return 'Änderung angefragt';
  if (hasOpenQuestion) return 'Rückfrage erhalten';
  if (share) {
    const now = Date.now();
    if (share.revokedAt || share.status === 'revoked') return 'Freigabe aufgehoben';
    if (share.status === 'expired' || new Date(share.validUntil).getTime() < now) {
      return 'Link abgelaufen';
    }
    if (share.status === 'active') return 'Freigegeben';
  }
  if (!readiness?.publicationAllowed) return 'Noch nicht freigegeben';
  return 'Noch nicht freigegeben';
}

export function OfferCustomerShareSection({
  offer,
  userContext,
  onUpdated,
}: OfferCustomerShareSectionProps) {
  const { offerWorkflowService, offerShareService, offerCustomerQuestionService } = useServices();
  const [readiness, setReadiness] = useState<OfferPublicationReadiness | null>(null);
  const [activeShare, setActiveShare] = useState<OfferShare | null>(null);
  const [hasOpenQuestion, setHasOpenQuestion] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [nextReadiness, share, openQuestions] = await Promise.all([
      offerWorkflowService.evaluatePublicationReadiness(offer.id),
      offerShareService.getActiveShareByOfferId(offer.id),
      offerCustomerQuestionService.getOpenQuestionsByOfferId(offer.id),
    ]);
    setReadiness(nextReadiness);
    setActiveShare(share);
    setHasOpenQuestion(openQuestions.length > 0);
    setLoading(false);
  }, [offer.id, offerCustomerQuestionService, offerShareService, offerWorkflowService]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusLabel = customerFacingStatus({
    readiness,
    share: activeShare,
    offer,
    hasOpenQuestion,
  });

  const handleCreateLink = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (!readiness?.publicationAllowed) {
        setMessage(readiness?.blockers[0] ?? 'Bitte Angebot zuerst intern freigeben.');
        return;
      }
      const result = await offerShareService.createCustomerShareLink(
        offer.id,
        userContext,
        readiness,
      );
      if (!result.ok) {
        setMessage(result.blockers?.[0] ?? 'Kundenlink konnte nicht erstellt werden.');
        return;
      }
      setRevealedToken(result.token);
      setActiveShare(result.share);
      setMessage(
        'Für den Kunden freigegeben. Link kopieren – er wird nur einmal angezeigt. Es wurde keine E-Mail versendet.',
      );
      onUpdated?.();
    } finally {
      setBusy(false);
      await load();
    }
  };

  const handleRevoke = async () => {
    if (!activeShare) return;
    setBusy(true);
    const result = await offerShareService.revokeShare(activeShare.id, userContext);
    setBusy(false);
    if (result.ok) {
      setActiveShare(null);
      setRevealedToken(null);
      setMessage('Freigabe aufgehoben. Der Link ist nicht mehr gültig.');
      onUpdated?.();
    }
  };

  const handleCopy = async () => {
    if (!revealedToken) return;
    const url = buildOfferReviewUrl(revealedToken);
    await navigator.clipboard.writeText(url);
    setMessage('Kundenlink in die Zwischenablage kopiert.');
  };

  if (loading) {
    return <p className={styles.hint}>Freigabe wird geladen…</p>;
  }

  return (
    <section className={styles.section} aria-labelledby="offer-customer-share-title">
      <div className={styles.header}>
        <div>
          <h2 id="offer-customer-share-title" className={styles.title}>
            Angebot für den Kunden freigeben
          </h2>
          <p className={styles.subtitle}>
            Sicherer Link ohne Login – 30 Tage gültig. Es wird nur ein Link erzeugt, kein
            automatischer Mailversand.
          </p>
        </div>
      </div>

      <p className={styles.message} role="status">
        Status: {statusLabel}
      </p>

      {!readiness?.publicationAllowed && !activeShare ? (
        <p className={styles.blocker} role="status">
          Noch nicht freigabefähig: {readiness?.blockers[0] ?? 'Interne Prüfung ausstehend.'}
        </p>
      ) : null}

      {message ? <p className={styles.message} role="status">{message}</p> : null}

      {activeShare ? (
        <dl className={styles.meta}>
          <div>
            <dt>Gültig bis</dt>
            <dd>{formatDateTime(activeShare.validUntil)}</dd>
          </div>
          <div>
            <dt>Aufrufe</dt>
            <dd>{activeShare.accessCount}</dd>
          </div>
          <div>
            <dt>Letzter Zugriff</dt>
            <dd>
              {activeShare.lastAccessAt ? formatDateTime(activeShare.lastAccessAt) : '–'}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className={styles.actions}>
        {!activeShare ? (
          <button
            type="button"
            className={styles.primaryAction}
            disabled={busy || !readiness?.publicationAllowed}
            onClick={() => void handleCreateLink()}
          >
            Für Kunden freigeben
          </button>
        ) : (
          <>
            {revealedToken ? (
              <button type="button" className={styles.primaryAction} onClick={() => void handleCopy()}>
                Kundenlink kopieren
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryAction}
                disabled={busy}
                onClick={() => void handleCreateLink()}
              >
                Link erneut erzeugen
              </button>
            )}
            <button
              type="button"
              className={styles.secondaryAction}
              disabled={busy}
              onClick={() => void handleRevoke()}
            >
              Freigabe aufheben
            </button>
          </>
        )}
      </div>
      {!readiness?.publicationAllowed ? (
        <p className={styles.hint}>
          Die Freigabe-Schaltfläche wird aktiv, sobald das Angebot intern freigegeben ist.
        </p>
      ) : null}
    </section>
  );
}
