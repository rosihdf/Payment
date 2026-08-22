import { type ReactNode, useMemo } from 'react';
import { getDataMode } from '../../config/dataMode';
import { LocalLeadDraftRepository } from '../../repositories/local/LocalLeadDraftRepository';
import { LocalLeadEditDraftRepository } from '../../repositories/local/LocalLeadEditDraftRepository';
import { createOperationalRepositories } from '../../repositories/supabase/createOperationalRepositories';
import { createServices } from '../../services';
import { seedDemoData } from '../../services/demoDataService';
import { ServicesContext } from '../../hooks/useServices';
import { createCoreRepositories } from './createCoreRepositories';

interface ServicesProviderProps {
  children: ReactNode;
}

export function ServicesProvider({ children }: ServicesProviderProps) {
  const services = useMemo(() => {
    const dataMode = getDataMode();
    if (dataMode === 'local') {
      // Entwicklungsmodus: Demo-Daten nur bei explizitem Local-Persistenzmodus.
      seedDemoData();
    }

    const core = createCoreRepositories();
    const operational = createOperationalRepositories();

    return createServices({
      ...core,
      ...operational,
      leadDraftRepository: new LocalLeadDraftRepository(),
      leadEditDraftRepository: new LocalLeadEditDraftRepository(),
    });
  }, []);

  return (
    <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
  );
}
