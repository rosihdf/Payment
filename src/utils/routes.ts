export const SALES_WORKSPACE_PATH = '/sales';
export const SALES_WIZARD_PATH = '/sales/wizard';
export const SALES_WIZARD_NEW_PATH = '/sales/wizard?new=1';
export const CALCULATOR_WIZARD_LEGACY_PATH = '/calculator/wizard';

export function salesWizardSessionPath(sessionId: string): string {
  return `${SALES_WIZARD_PATH}?session=${encodeURIComponent(sessionId)}`;
}
