import { useContext } from 'react';
import { ToastContext } from '../app/providers/toastContext';
import type { ToastVariant } from '../app/providers/toastContext';

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}

export type { ToastVariant };
