import {
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  ToastContext,
  type ToastContextValue,
  type ToastMessage,
  type ToastVariant,
} from './toastContext';

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, message, variant }]);

      window.setTimeout(() => {
        dismissToast(id);
      }, 4000);
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      showToast,
      dismissToast,
    }),
    [toasts, showToast, dismissToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
