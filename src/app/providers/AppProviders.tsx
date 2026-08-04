import { type ReactNode } from 'react';
import { AppUpdateProvider } from './AppUpdateProvider';
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
        <AppUpdateProvider>
          <ToastProvider>{children}</ToastProvider>
        </AppUpdateProvider>
      </CurrentUserProvider>
    </ServicesProvider>
  );
}
