import { Navigate, useLocation } from 'react-router-dom';
import { SALES_WIZARD_PATH } from '../utils/routes';

export function CalculatorWizardRedirect() {
  const location = useLocation();
  return <Navigate to={`${SALES_WIZARD_PATH}${location.search}`} replace />;
}
