import type { ContractTerm } from '../pricing/contractTerm';
import type { PricingEvaluationInput } from '../pricing/pricingEvaluation';
import { createFinding, PRICING_FINDING_CODES, type PricingFinding } from '../pricing/pricingFinding';

function isTermActiveOnDate(term: ContractTerm, evaluationDate: string): boolean {
  if (term.status !== 'active') {
    return false;
  }

  const date = new Date(`${evaluationDate.slice(0, 10)}T00:00:00.000Z`);
  if (term.validFrom) {
    const from = new Date(`${term.validFrom.slice(0, 10)}T00:00:00.000Z`);
    if (date < from) {
      return false;
    }
  }

  if (term.validUntil) {
    const until = new Date(`${term.validUntil.slice(0, 10)}T00:00:00.000Z`);
    if (date > until) {
      return false;
    }
  }

  return true;
}

export interface TermEvaluationResult {
  termMonths: number | null;
  isStandardTerm: boolean;
  isSpecialTerm: boolean;
  termAllowed: boolean;
  contractTermId: string | null;
  findings: PricingFinding[];
}

export function evaluateContractTerm(
  input: PricingEvaluationInput,
  terms: ContractTerm[],
): TermEvaluationResult {
  const findings: PricingFinding[] = [];

  if (input.requestedSpecialTermMonths !== null) {
    if (!Number.isInteger(input.requestedSpecialTermMonths) || input.requestedSpecialTermMonths < 1) {
      findings.push(
        createFinding({
          code: PRICING_FINDING_CODES.REQUIRED_INPUT_MISSING,
          severity: 'blocking',
          category: 'term',
          field: 'requestedSpecialTermMonths',
          ruleId: null,
          blocking: true,
          internalDescription: 'Sonderlaufzeit benötigt eine positive ganze Monatszahl.',
          salesDescription: 'Bitte geben Sie eine gültige Sonderlaufzeit in Monaten an.',
          requiredAction: 'Sonderlaufzeit korrigieren',
        }),
      );
      return {
        termMonths: null,
        isStandardTerm: false,
        isSpecialTerm: true,
        termAllowed: false,
        contractTermId: null,
        findings,
      };
    }

    if (!input.specialTermReason.trim()) {
      findings.push(
        createFinding({
          code: PRICING_FINDING_CODES.SPECIAL_TERM_REASON_REQUIRED,
          severity: 'blocking',
          category: 'term',
          field: 'specialTermReason',
          ruleId: null,
          blocking: true,
          internalDescription: 'Sonderlaufzeit benötigt eine Begründung.',
          salesDescription: 'Bitte begründen Sie die beantragte Sonderlaufzeit.',
          requiredAction: 'Begründung ergänzen',
        }),
      );
    }

    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.SPECIAL_TERM_REQUESTED,
        severity: 'error',
        category: 'term',
        field: 'requestedSpecialTermMonths',
        ruleId: null,
        blocking: false,
        internalDescription: 'Sonderlaufzeit beantragt.',
        salesDescription: 'Die beantragte Laufzeit erfordert eine Adminprüfung.',
        requiredAction: 'Adminprüfung abwarten',
        context: { months: input.requestedSpecialTermMonths },
      }),
    );

      return {
      termMonths: input.requestedSpecialTermMonths,
      isStandardTerm: false,
      isSpecialTerm: true,
      termAllowed: input.specialTermReason.trim().length > 0,
      contractTermId: null,
      findings,
    };
  }

  if (!input.contractTermId) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.CONTRACT_TERM_NOT_FOUND,
        severity: 'blocking',
        category: 'term',
        field: 'contractTermId',
        ruleId: null,
        blocking: true,
        internalDescription: 'Es wurde keine Vertragslaufzeit ausgewählt.',
        salesDescription: 'Bitte wählen Sie eine Vertragslaufzeit.',
        requiredAction: 'Laufzeit auswählen',
      }),
    );

    return {
      termMonths: null,
      isStandardTerm: false,
      isSpecialTerm: false,
      termAllowed: false,
      contractTermId: null,
      findings,
    };
  }

  const term = terms.find((item) => item.id === input.contractTermId);
  if (!term) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.CONTRACT_TERM_NOT_FOUND,
        severity: 'blocking',
        category: 'term',
        field: 'contractTermId',
        ruleId: null,
        blocking: true,
        internalDescription: 'Die gewählte Vertragslaufzeit wurde nicht gefunden.',
        salesDescription: 'Die gewählte Laufzeit ist unbekannt.',
        requiredAction: 'Laufzeit prüfen',
      }),
    );

    return {
      termMonths: null,
      isStandardTerm: false,
      isSpecialTerm: false,
      termAllowed: false,
      contractTermId: input.contractTermId,
      findings,
    };
  }

  if (!isTermActiveOnDate(term, input.evaluationDate)) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.CONTRACT_TERM_INACTIVE,
        severity: 'blocking',
        category: 'term',
        field: 'contractTermId',
        ruleId: null,
        blocking: true,
        internalDescription: 'Die gewählte Vertragslaufzeit ist am Stichtag nicht aktiv.',
        salesDescription: 'Die gewählte Laufzeit ist derzeit nicht verfügbar.',
        requiredAction: 'Andere Laufzeit wählen',
      }),
    );
  }

  if (input.contractTypeId && term.contractTypeId && term.contractTypeId !== input.contractTypeId) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.UNSUPPORTED_PRODUCT_COMBINATION,
        severity: 'blocking',
        category: 'term',
        field: 'contractTermId',
        ruleId: null,
        blocking: true,
        internalDescription: 'Laufzeit passt nicht zur gewählten Vertragsart.',
        salesDescription: 'Diese Laufzeit ist für die gewählte Vertragsart nicht zulässig.',
        requiredAction: 'Kombination prüfen',
      }),
    );
  }

  return {
    termMonths: term.months,
    isStandardTerm: term.isStandard,
    isSpecialTerm: !term.isStandard,
    termAllowed: isTermActiveOnDate(term, input.evaluationDate),
    contractTermId: term.id,
    findings,
  };
}
