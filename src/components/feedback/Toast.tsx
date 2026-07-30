import styles from './Toast.module.css';
import { useToast, type ToastVariant } from '../../hooks/useToast';

const variantLabels: Record<ToastVariant, string> = {
  info: 'Info',
  success: 'Erfolg',
  warning: 'Hinweis',
  error: 'Fehler',
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.variant]}`}>
          <div className={styles.content}>
            <span className={styles.variant}>{variantLabels[toast.variant]}</span>
            <p className={styles.message}>{toast.message}</p>
          </div>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => dismissToast(toast.id)}
            aria-label="Benachrichtigung schließen"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
