import { useCallback, useEffect, useState } from 'react';
import { downloadBlob } from '../../utils/downloadBlob';
import styles from './OfferPdfPreview.module.css';

interface OfferPdfPreviewProps {
  blob: Blob;
  filename: string;
  title?: string;
}

function useIsMobilePreview(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia('(max-width: 768px)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}

export function OfferPdfPreview({ blob, filename, title }: OfferPdfPreviewProps) {
  const isMobile = useIsMobilePreview();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  const handleDownload = useCallback(() => {
    downloadBlob(blob, filename);
  }, [blob, filename]);

  if (!blobUrl) {
    return null;
  }

  return (
    <div className={styles.preview}>
      <div className={styles.toolbar}>
        {title ? <h2 className={styles.title}>{title}</h2> : null}
        <button type="button" className={styles.downloadButton} onClick={handleDownload}>
          PDF herunterladen
        </button>
      </div>

      {isMobile ? (
        <div className={styles.mobileFallback}>
          <p className={styles.mobileHint}>
            PDF-Vorschau ist auf diesem Gerät eingeschränkt. Öffnen oder laden Sie das Dokument
            stattdessen herunter.
          </p>
          <a className={styles.mobileLink} href={blobUrl} download={filename} target="_blank" rel="noreferrer">
            PDF öffnen oder herunterladen
          </a>
        </div>
      ) : (
        <iframe
          className={styles.frame}
          src={blobUrl}
          title={title ?? filename}
        />
      )}
    </div>
  );
}
