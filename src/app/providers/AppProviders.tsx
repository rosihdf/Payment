import { type ReactNode } from 'react';
import { AndroidApkUpdateProvider } from '../../context/AndroidApkUpdateProvider';
import { CurrentUserProvider } from './CurrentUserProvider';
import { ServicesProvider } from './ServicesProvider';
import { ToastProvider } from './ToastProvider';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ServicesProvider>
      <CurrentUserProvider>
        <AndroidApkUpdateProvider>
          <ToastProvider>{children}</ToastProvider>
        </AndroidApkUpdateProvider>
      </CurrentUserProvider>
    </ServicesProvider>
  );
}
