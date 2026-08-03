import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './Dialog.module.css';

export interface DialogAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'text';
  loading?: boolean;
  disabled?: boolean;
}

export interface DialogProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  primaryAction?: DialogAction;
  secondaryAction?: DialogAction;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export function Dialog({
  isOpen,
  title,
  children,
  onClose,
  primaryAction,
  secondaryAction,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: DialogProps) {
  const titleId = useId();
  const secondaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    secondaryRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEscape, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} role="presentation" onClick={handleBackdropClick}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        {primaryAction || secondaryAction ? (
          <div className={styles.actions}>
            {secondaryAction ? (
              <Button
                ref={secondaryRef}
                type="button"
                variant={secondaryAction.variant ?? 'secondary'}
                loading={secondaryAction.loading}
                disabled={secondaryAction.disabled}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
            {primaryAction ? (
              <Button
                type="button"
                variant={primaryAction.variant ?? 'primary'}
                loading={primaryAction.loading}
                disabled={primaryAction.disabled}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
