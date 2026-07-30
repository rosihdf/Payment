import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Offer } from '../../domain/offer/offer';
import type { OfferDocument } from '../../domain/offerDocument/offerDocument';
import type { OfferUserContext } from '../../services/offerService';
import type { OfferDocumentService } from '../../services/offerDocumentService';
import { OfferDocumentCard } from './OfferDocumentCard';
import {
  OfferDocumentDialogs,
  OfferDocumentSectionHint,
  type OfferDocumentDialogMode,
} from './OfferDocumentDialogs';
import styles from './OfferDocumentsSection.module.css';

interface OfferDocumentsSectionProps {
  offer: Offer;
  userContext: OfferUserContext;
  offerDocumentService: OfferDocumentService;
  onDocumentsChanged?: () => void;
  showToast: (message: string, variant: 'success' | 'error') => void;
}

export function OfferDocumentsSection({
  offer,
  userContext,
  offerDocumentService,
  onDocumentsChanged,
  showToast,
}: OfferDocumentsSectionProps) {
  const [documents, setDocuments] = useState<OfferDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<OfferDocumentDialogMode>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    const loadedDocuments = await offerDocumentService.getDocumentsForOffer(offer.id, userContext);
    setDocuments(loadedDocuments.sort((left, right) => right.version - left.version));
    setIsLoading(false);
  }, [offer.id, offerDocumentService, userContext]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const currentDocument = offerDocumentService.getCurrentGeneratedDocument(documents);
  const canPreview = offer.status !== 'cancelled';
  const canCreateFinal = offer.status === 'completed' && !currentDocument;
  const canCreateNewVersion = offer.status === 'completed' && Boolean(currentDocument);

  const handleDownload = (documentId: string) => {
    void (async () => {
      setDownloadingDocumentId(documentId);
      const result = await offerDocumentService.downloadStoredDocument(documentId, userContext);

      if (result.ok) {
        showToast('PDF wurde heruntergeladen', 'success');
      } else {
        showToast('PDF konnte nicht heruntergeladen werden', 'error');
      }

      setDownloadingDocumentId(null);
    })();
  };

  const handleCreateFinal = () => {
    void (async () => {
      setIsActionRunning(true);
      const result = await offerDocumentService.createFinalDocument(offer.id, userContext);

      if (result.ok) {
        showToast('Finales PDF wurde erzeugt', 'success');
        await loadDocuments();
        onDocumentsChanged?.();
      } else if ('errors' in result) {
        showToast('PDF konnte nicht erzeugt werden – bitte prüfen Sie die Pflichtfelder.', 'error');
      } else if (result.error === 'already_exists') {
        setDialogMode('existingDocument');
      } else {
        showToast('PDF konnte nicht erzeugt werden', 'error');
      }

      setIsActionRunning(false);
      setDialogMode(null);
    })();
  };

  const handleCreateNewVersion = () => {
    void (async () => {
      setIsActionRunning(true);
      const result = await offerDocumentService.createNewFinalVersion(offer.id, userContext);

      if (result.ok) {
        showToast('Neue PDF-Version wurde erzeugt', 'success');
        await loadDocuments();
        onDocumentsChanged?.();
      } else if ('errors' in result) {
        showToast('Neue Version konnte nicht erzeugt werden – bitte prüfen Sie die Pflichtfelder.', 'error');
      } else {
        showToast('Neue Version konnte nicht erzeugt werden', 'error');
      }

      setIsActionRunning(false);
      setDialogMode(null);
    })();
  };

  return (
    <section className={styles.section} aria-labelledby="offer-documents-heading">
      <div className={styles.header}>
        <h2 id="offer-documents-heading" className={styles.title}>
          PDF-Dokumente
        </h2>
        <div className={styles.actions}>
          {canPreview ? (
            <Link className={styles.secondaryAction} to={`/offers/${offer.id}/preview`}>
              PDF-Vorschau
            </Link>
          ) : null}
          {canCreateFinal ? (
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isActionRunning}
              onClick={() => setDialogMode('createFinal')}
            >
              Finales PDF erzeugen
            </button>
          ) : null}
          {canCreateNewVersion ? (
            <button
              type="button"
              className={styles.secondaryAction}
              disabled={isActionRunning}
              onClick={() => setDialogMode('createNewVersion')}
            >
              Neue Dokumentversion erzeugen
            </button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <OfferDocumentSectionHint>Dokumente werden geladen…</OfferDocumentSectionHint>
      ) : documents.length === 0 ? (
        <OfferDocumentSectionHint>
          Für dieses Angebot wurden noch keine finalen PDF-Dokumente gespeichert.
        </OfferDocumentSectionHint>
      ) : (
        <ul className={styles.list}>
          {documents.map((document) => (
            <li key={document.id}>
              <OfferDocumentCard
                document={document}
                offerId={offer.id}
                onDownload={handleDownload}
                isDownloading={downloadingDocumentId === document.id}
              />
            </li>
          ))}
        </ul>
      )}

      <OfferDocumentDialogs
        mode={dialogMode}
        isRunning={isActionRunning}
        onCancel={() => setDialogMode(null)}
        onConfirmCreateFinal={handleCreateFinal}
        onConfirmCreateNewVersion={handleCreateNewVersion}
        onConfirmExistingDocument={handleCreateNewVersion}
      />
    </section>
  );
}
