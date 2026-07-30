import { createContext, useContext } from 'react';
import type { AppServices } from '../services';

export const ServicesContext = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used within ServicesProvider');
  }

  return context;
}
