import { type ReactNode } from 'react';
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
        <ToastProvider>{children}</ToastProvider>
      </CurrentUserProvider>
    </ServicesProvider>
  );
}
