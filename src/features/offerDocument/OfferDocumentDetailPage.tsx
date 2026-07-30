import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import type { OfferDocument } from '../../domain/offerDocument/offerDocument';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { displayDateTime, displayText } from '../../utils/format';
import { OfferDocumentStatusBadge } from './OfferDocumentStatusBadge';
import { OfferPdfPreview } from './OfferPdfPreview';
import styles from './OfferDocumentDetailPage.module.css';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function OfferDocumentDetailPage() {
  const { offerId, documentId } = useParams<{ offerId: string; documentId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { offerDocumentService } = useServices();
  const { showToast } = useToast();

  const [document, setDocument] = useState<OfferDocument | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfFilename, setPdfFilename] = useState('');
  const [integrityValid, setIntegrityValid] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const userContext = useMemo(
    () =>
      currentUser
        ? {
            userId: currentUser.id,
            role: currentUser.role,
            displayName: currentUser.name,
          }
        : null,
    [currentUser],
  );

  useEffect(() => {
    if (!documentId || !userContext) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      const loadedDocument = await offerDocumentService.getDocumentById(documentId, userContext);
      if (cancelled) {
        return;
      }

      if (!loadedDocument) {
        setDocument(null);
        setPdfBlob(null);
        setIntegrityValid(null);
        setIsLoading(false);
        return;
      }

      setDocument(loadedDocument);

      const integrity = await offerDocumentService.verifyDocumentIntegrity(documentId, userContext);
      if (cancelled) {
        return;
      }

      setIntegrityValid(integrity?.valid ?? null);

      const pdfResult = await offerDocumentService.generatePdfForStoredDocument(documentId, userContext);
      if (cancelled) {
        return;
      }

      if (pdfResult.ok) {
        setPdfBlob(pdfResult.blob);
        setPdfFilename(pdfResult.filename);
      } else {
        setPdfBlob(null);
        setPdfFilename('');
        showToast('PDF konnte nicht geladen werden', 'error');
      }

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, offerDocumentService, showToast, userContext]);

  const handleDownload = () => {
    if (!documentId || !userContext) {
      return;
    }

    void (async () => {
      setIsDownloading(true);
      const result = await offerDocumentService.downloadStoredDocument(documentId, userContext);

      if (result.ok) {
        showToast('PDF wurde heruntergeladen', 'success');
      } else {
        showToast('PDF konnte nicht heruntergeladen werden', 'error');
      }

      setIsDownloading(false);
    })();
  };

  if (isLoading) {
    return (
      <section>
        <PageHeader title="PDF-Dokument" subtitle="Daten werden geladen…" />
        <EmptyState title="Dokument wird geladen" description="Die Dokumentdetails werden abgerufen." />
      </section>
    );
  }

  if (!document) {
    return (
      <section>
        <PageHeader title="Dokument nicht gefunden" />
        <EmptyState
          title="Dokument nicht gefunden"
          description="Das angeforderte PDF-Dokument existiert nicht oder Sie haben keinen Zugriff."
          action={
            offerId ? (
              <Link className={styles.link} to={`/offers/${offerId}`}>
                Zurück zum Angebot
              </Link>
            ) : (
              <Link className={styles.link} to="/offers">
                Zur Angebotsübersicht
              </Link>
            )
          }
        />
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title={document.documentNumber}
        subtitle={`${document.offerNumber} · Version ${document.version}`}
        actions={
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isDownloading}
              onClick={handleDownload}
            >
              PDF herunterladen
            </button>
            <Link className={styles.secondaryAction} to={`/offers/${document.offerId}`}>
              Zum Angebot
            </Link>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => navigate(-1)}
            >
              Zurück
            </button>
          </div>
        }
      />

      <div className={styles.statusRow}>
        <OfferDocumentStatusBadge status={document.status} />
        {integrityValid === true ? (
          <span className={styles.integrityOk}>Integrität geprüft</span>
        ) : integrityValid === false ? (
          <span className={styles.integrityError}>Integritätsprüfung fehlgeschlagen</span>
        ) : null}
      </div>

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Dokumentmetadaten</h2>
        <dl className={styles.grid}>
          <DetailRow label="Angebotsnummer" value={displayText(document.offerNumber)} />
          <DetailRow label="Dokumentnummer" value={displayText(document.documentNumber)} />
          <DetailRow label="Version" value={String(document.version)} />
          <DetailRow label="Erzeugt am" value={displayDateTime(document.createdAt)} />
          <DetailRow
            label="Erzeugt von"
            value={displayText(document.snapshot.generatedByDisplayName)}
          />
          <DetailRow
            label="Angebotsstatus bei Erzeugung"
            value={displayText(document.snapshot.offerStatusAtGeneration)}
          />
        </dl>
      </section>

      {pdfBlob ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>PDF-Vorschau</h2>
          <OfferPdfPreview
            blob={pdfBlob}
            filename={pdfFilename}
            title={document.documentNumber}
          />
        </section>
      ) : null}
    </section>
  );
}

export function OfferDocumentPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useCurrentUser();
  const { offerDocumentService } = useServices();
  const { showToast } = useToast();

  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfFilename, setPdfFilename] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const userContext = useMemo(
    () =>
      currentUser
        ? {
            userId: currentUser.id,
            role: currentUser.role,
            displayName: currentUser.name,
          }
        : null,
    [currentUser],
  );

  useEffect(() => {
    if (!id || !userContext) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void (async () => {
      const result = await offerDocumentService.generatePreviewPdf(id, userContext);
      if (cancelled) {
        return;
      }

      if (result.ok) {
        setPdfBlob(result.blob);
        setPdfFilename(result.filename);
      } else if ('errors' in result) {
        const message = Object.values(result.errors).join(' ');
        setLoadError(message || 'Vorschau konnte nicht erzeugt werden.');
        showToast(message || 'Vorschau konnte nicht erzeugt werden.', 'error');
      } else {
        setLoadError('Vorschau konnte nicht erzeugt werden.');
        showToast('Vorschau konnte nicht erzeugt werden.', 'error');
      }

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, offerDocumentService, showToast, userContext]);

  if (isLoading) {
    return (
      <section>
        <PageHeader title="PDF-Vorschau" subtitle="Vorschau wird erzeugt…" />
        <EmptyState title="Vorschau wird geladen" description="Das PDF wird erzeugt." />
      </section>
    );
  }

  if (!pdfBlob || loadError) {
    return (
      <section>
        <PageHeader title="PDF-Vorschau" />
        <EmptyState
          title="Vorschau nicht verfügbar"
          description={loadError ?? 'Die PDF-Vorschau konnte nicht erzeugt werden.'}
          action={
            id ? (
              <Link className={styles.link} to={`/offers/${id}`}>
                Zurück zum Angebot
              </Link>
            ) : undefined
          }
        />
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title="PDF-Vorschau"
        subtitle="Unverbindliche Vorschau – nicht gespeichert"
        actions={
          id ? (
            <Link className={styles.secondaryAction} to={`/offers/${id}`}>
              Zum Angebot
            </Link>
          ) : undefined
        }
      />
      <section className={styles.detailSection}>
        <OfferPdfPreview blob={pdfBlob} filename={pdfFilename} title="PDF-Vorschau" />
      </section>
    </section>
  );
}
