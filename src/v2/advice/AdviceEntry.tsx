import { useSearchParams } from 'react-router-dom';
import { AdviceHubPage } from './AdviceHubPage';
import { AdviceWizardPage } from './AdviceWizardPage';

export function AdviceEntry() {
  const [params] = useSearchParams();
  const opensProcess =
    Boolean(params.get('session')) ||
    params.get('new') === '1' ||
    Boolean(params.get('leadId'));

  if (opensProcess) {
    return <AdviceWizardPage />;
  }

  return <AdviceHubPage />;
}
