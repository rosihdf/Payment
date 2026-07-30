import type { ReactNode } from 'react';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import styles from './OfferDocumentDialogs.module.css';

export type OfferDocumentDialogMode = 'createFinal' | 'createNewVersion' | 'existingDocument' | null;

interface OfferDocumentDialogsProps {
  mode: OfferDocumentDialogMode;
  isRunning: boolean;
  onCancel: () => void;
  onConfirmCreateFinal: () => void;
  onConfirmCreateNewVersion: () => void;
  onConfirmExistingDocument?: () => void;
}

export function OfferDocumentDialogs({
  mode,
  isRunning,
  onCancel,
  onConfirmCreateFinal,
  onConfirmCreateNewVersion,
  onConfirmExistingDocument,
}: OfferDocumentDialogsProps) {
  return (
    <>
      <ConfirmDialog
        isOpen={mode === 'createFinal'}
        title="Finales PDF erzeugen"
        message="Es wird ein unveränderliches PDF-Dokument mit Prüfsumme für das abgeschlossene Angebot erzeugt und gespeichert."
        cancelLabel="Abbrechen"
        confirmLabel={isRunning ? 'Wird erzeugt…' : 'Finales PDF erzeugen'}
        onCancel={onCancel}
        onConfirm={onConfirmCreateFinal}
      />

      <ConfirmDialog
        isOpen={mode === 'createNewVersion'}
        title="Neue Dokumentversion erzeugen"
        message="Die aktuelle Dokumentversion wird als frühere Version markiert. Es wird eine neue finale PDF-Version erzeugt."
        cancelLabel="Abbrechen"
        confirmLabel={isRunning ? 'Wird erzeugt…' : 'Neue Dokumentversion erzeugen'}
        onCancel={onCancel}
        onConfirm={onConfirmCreateNewVersion}
      />

      <ConfirmDialog
        isOpen={mode === 'existingDocument'}
        title="Dokument bereits vorhanden"
        message="Für dieses Angebot existiert bereits ein aktuelles PDF-Dokument. Möchten Sie stattdessen eine neue Dokumentversion erzeugen?"
        cancelLabel="Abbrechen"
        confirmLabel={isRunning ? 'Wird erzeugt…' : 'Neue Dokumentversion erzeugen'}
        onCancel={onCancel}
        onConfirm={onConfirmExistingDocument ?? onConfirmCreateNewVersion}
      />
    </>
  );
}

export function OfferDocumentSectionHint({ children }: { children: ReactNode }) {
  return <p className={styles.hint}>{children}</p>;
}
