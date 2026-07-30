import { createContext } from 'react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

export interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
