import { type ReactNode, useMemo } from 'react';
import { LocalLeadDraftRepository } from '../../repositories/local/LocalLeadDraftRepository';
import { LocalLeadEditDraftRepository } from '../../repositories/local/LocalLeadEditDraftRepository';
import { LocalLeadRepository } from '../../repositories/local/LocalLeadRepository';
import { LocalTariffRepository } from '../../repositories/local/LocalTariffRepository';
import { LocalUserRepository } from '../../repositories/local/LocalUserRepository';
import { createServices } from '../../services';
import { seedDemoData } from '../../services/demoDataService';
import { ServicesContext } from '../../hooks/useServices';

interface ServicesProviderProps {
  children: ReactNode;
}

export function ServicesProvider({ children }: ServicesProviderProps) {
  const services = useMemo(() => {
    seedDemoData();

    return createServices({
      userRepository: new LocalUserRepository(),
      leadRepository: new LocalLeadRepository(),
      leadDraftRepository: new LocalLeadDraftRepository(),
      leadEditDraftRepository: new LocalLeadEditDraftRepository(),
      tariffRepository: new LocalTariffRepository(),
    });
  }, []);

  return (
    <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
  );
}
