import { useSearchParams } from 'react-router-dom';
import { AdviceHubPage } from './AdviceHubPage';
import { SalesWizardPage } from './SalesWizardPage';

/**
 * /advice ohne Prozessparameter → Hub.
 * Mit session/new/leadId → führender Beratungsweg (SalesWizard).
 */
export function AdviceEntry() {
  const [params] = useSearchParams();
  const opensProcess =
    Boolean(params.get('session')) ||
    params.get('new') === '1' ||
    Boolean(params.get('leadId'));

  if (opensProcess) {
    return <SalesWizardPage />;
  }

  return <AdviceHubPage />;
}
