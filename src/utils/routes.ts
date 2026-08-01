export const SALES_WORKSPACE_PATH = '/sales';
export const ADVICE_PATH = '/advice';
export const ADVICE_NEW_PATH = '/advice?new=1';
export const ADVICE_QUICK_PATH = '/advice/quick';
/** @deprecated Use ADVICE_PATH – kept for legacy imports/tests */
export const SALES_WIZARD_PATH = ADVICE_PATH;
/** @deprecated Use ADVICE_NEW_PATH */
export const SALES_WIZARD_NEW_PATH = ADVICE_NEW_PATH;
export const CALCULATOR_WIZARD_LEGACY_PATH = '/calculator/wizard';
export const LEGACY_SALES_WIZARD_PATH = '/sales/wizard';

export function salesWizardSessionPath(sessionId: string): string {
  return `${ADVICE_PATH}?session=${encodeURIComponent(sessionId)}`;
}

export function adviceSessionPath(sessionId: string): string {
  return salesWizardSessionPath(sessionId);
}
