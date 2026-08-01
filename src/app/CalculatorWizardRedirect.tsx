import { PreserveSearchRedirect } from './PreserveSearchRedirect';
import { ADVICE_PATH } from '../utils/routes';

/** Legacy /calculator/wizard → /advice (Query erhalten). */
export function CalculatorWizardRedirect() {
  return <PreserveSearchRedirect to={ADVICE_PATH} />;
}
