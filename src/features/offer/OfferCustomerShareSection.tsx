import { useCallback, useEffect, useState } from 'react';
import type { Offer } from '../../domain/offer/offer';
import type { OfferPublicationReadiness } from '../../domain/offer/offerPublicationReadiness';
import type { OfferShare } from '../../domain/offer/offerShare';
import { SHARE_STATUS_LABELS } from '../../domain/offer/offerShare';
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
  const [readiness, setReadiness] = useState<OfferPublicationReadiness | null>(null);
  const [activeShare, setActiveShare] = useState<OfferShare | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [nextReadiness, share] = await Promise.all([
      offerWorkflowService.evaluatePublicationReadiness(offer.id),
      offerShareService.getActiveShareByOfferId(offer.id),
    ]);
    setReadiness(nextReadiness);
    setActiveShare(share);
    setLoading(false);
  }, [offer.id, offerShareService, offerWorkflowService]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setMessage(null);
    const result = await offerShareService.createCustomerShareLink(offer.id, userContext, readiness);
    if (!result.ok) {
      setMessage(result.blockers?.[0] ?? 'Kundenlink konnte nicht erstellt werden.');
      return;
    }
    setRevealedToken(result.token);
    setActiveShare(result.share);
    setMessage('Link erstellt. Kopieren Sie ihn jetzt – er wird nur einmal angezeigt.');
    onUpdated?.();
  };

  const handleRevoke = async () => {
    if (!activeShare) return;
    const result = await offerShareService.revokeShare(activeShare.id, userContext);
    if (result.ok) {
      setActiveShare(null);
      setRevealedToken(null);
      setMessage('Kundenlink widerrufen.');
      onUpdated?.();
    }
  };

  const handleCopy = async () => {
    if (!revealedToken) return;
    const url = buildOfferReviewUrl(revealedToken);
    await navigator.clipboard.writeText(url);
    setMessage('Link in die Zwischenablage kopiert.');
  };

  if (loading) {
    return <p className={styles.hint}>Kundenvorlage wird geladen…</p>;
  }

  return (
    <section className={styles.section} aria-labelledby="offer-customer-share-title">
      <div className={styles.header}>
        <div>
          <h2 id="offer-customer-share-title" className={styles.title}>Kundenvorlage</h2>
          <p className={styles.subtitle}>
            Sicherer Link zur Angebotsprüfung – ohne Login, 30 Tage gültig.
          </p>
        </div>
      </div>

      {!readiness?.publicationAllowed ? (
        <p className={styles.blocker} role="status">
          Kundenvorlage noch nicht möglich: {readiness?.blockers[0] ?? 'Freigabe ausstehend.'}
        </p>
      ) : null}

      {message ? <p className={styles.message} role="status">{message}</p> : null}

      {activeShare ? (
        <dl className={styles.meta}>
          <div><dt>Version</dt><dd>{readiness?.currentVersionNumber ?? '–'}</dd></div>
          <div><dt>Erstellt</dt><dd>{formatDateTime(activeShare.createdAt)}</dd></div>
          <div><dt>Gültig bis</dt><dd>{formatDateTime(activeShare.validUntil)}</dd></div>
          <div><dt>Status</dt><dd>{SHARE_STATUS_LABELS[offerShareService.resolveShareStatus(activeShare)]}</dd></div>
          <div><dt>Aufrufe</dt><dd>{activeShare.accessCount}</dd></div>
          <div><dt>Letzter Zugriff</dt><dd>{activeShare.lastAccessAt ? formatDateTime(activeShare.lastAccessAt) : '–'}</dd></div>
        </dl>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={!readiness?.publicationAllowed}
          onClick={() => void handleCreate()}
        >
          {activeShare ? 'Link neu erzeugen' : 'Kundenlink erstellen'}
        </button>
        {revealedToken ? (
          <button type="button" className={styles.secondaryAction} onClick={() => void handleCopy()}>
            Link kopieren
          </button>
        ) : null}
        {activeShare && activeShare.status === 'active' ? (
          <button type="button" className={styles.secondaryAction} onClick={() => void handleRevoke()}>
            Link widerrufen
          </button>
        ) : null}
      </div>
    </section>
  );
}
