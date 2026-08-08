import type { BestPayComparisonSession } from './bestPayComparisonSession';
import type { SalesWizardScenario, SalesWizardScenarioConfig } from './salesWizard';

/** Leitet Szenario-Konfiguration aus dem persistierten Need ab – nie umgekehrt. */
export function deriveScenarioConfigFromNeed(
  session: Pick<BestPayComparisonSession, 'manualInput'>,
  label: string,
): SalesWizardScenarioConfig {
  return {
    label,
    preferredTermMonths: session.manualInput.preferredTermMonths,
    terminalCount: session.manualInput.terminalCount,
    paymentUsage: { ...session.manualInput.paymentUsage },
  };
}

export function syncScenarioConfigsFromNeed(session: BestPayComparisonSession): void {
  for (const scenario of session.wizard.scenarios) {
    const derived = deriveScenarioConfigFromNeed(session, scenario.config.label);
    scenario.config = {
      ...scenario.config,
      ...derived,
      label: scenario.config.label,
    };
    if (scenario.result && !scenario.result.stale) {
      scenario.result = {
        ...scenario.result,
        stale: true,
        staleReasons: [...scenario.result.staleReasons, 'need_changed'],
      };
    }
  }
}

export function markScenarioStaleAfterNeedChange(scenario: SalesWizardScenario): void {
  if (scenario.result && !scenario.result.stale) {
    scenario.result = {
      ...scenario.result,
      stale: true,
      staleReasons: [...scenario.result.staleReasons, 'need_changed'],
    };
  }
}
