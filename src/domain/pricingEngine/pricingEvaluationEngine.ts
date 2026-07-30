import type { PriceRule } from '../pricing/priceRule';
import {
  createFinding,
  PRICING_FINDING_CODES,
  type PricingFinding,
  type PricingReviewClass,
} from '../pricing/pricingFinding';
import type {
  ApprovalPreparation,
  PricingEvaluationInput,
  PricingEvaluationResult,
  PricingEvaluationSnapshot,
} from '../pricing/pricingEvaluation';
import {
  PRICING_ENGINE_VERSION,
  PRICING_EVALUATION_SNAPSHOT_SCHEMA_VERSION,
} from '../pricing/pricingEvaluation';
import type { PriceBookVersion } from '../pricing/priceBook';
import type { ContractTerm } from '../pricing/contractTerm';
import { createPricingEvaluationFingerprint } from './pricingEvaluationFingerprint';
import { selectPriceRules } from './ruleMatching';
import { evaluateContractTerm } from './termEvaluation';
import { resolvePublishedPriceBookVersion } from './versionResolution';
import { generateId } from '../../utils/id';

export interface PricingCatalogContext {
  priceBookVersions: PriceBookVersion[];
  priceRules: PriceRule[];
  contractTerms: ContractTerm[];
}

function mergePrimaryRule(rules: PriceRule[]): PriceRule | null {
  if (rules.length === 0) {
    return null;
  }

  return rules.slice().sort((left, right) => right.priority - left.priority)[0] ?? null;
}

function evaluatePriceBounds(
  input: PricingEvaluationInput,
  rule: PriceRule | null,
): {
  listPriceCents: number | null;
  targetPriceCents: number | null;
  minimumPriceCents: number | null;
  maxDiscountPercentTenths: number | null;
  requestedPriceCents: number | null;
  evaluatedPriceCents: number | null;
  absoluteDeviationCents: number | null;
  percentDeviationTenths: number | null;
  findings: PricingFinding[];
} {
  const findings: PricingFinding[] = [];

  const listPriceCents = rule?.listPriceCents ?? null;
  const targetPriceCents = rule?.targetPriceCents ?? null;
  const minimumPriceCents = rule?.minimumPriceCents ?? null;
  const maxDiscountPercentTenths = rule?.maxDiscountPercentTenths ?? null;

  const requestedPriceCents =
    input.requestedTotalPriceCents ??
    (input.requestedUnitPriceCents !== null ? input.requestedUnitPriceCents * input.quantity : null);

  let evaluatedPriceCents = requestedPriceCents ?? targetPriceCents ?? listPriceCents;

  if (input.manualPriceOverride && !input.overrideReason.trim()) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.MANUAL_OVERRIDE_REQUIRES_REASON,
        severity: 'blocking',
        category: 'price',
        field: 'overrideReason',
        ruleId: rule?.id ?? null,
        blocking: true,
        internalDescription: 'Manuelle Preisabweichung benötigt eine Begründung.',
        salesDescription: 'Bitte begründen Sie die manuelle Preisänderung.',
        requiredAction: 'Begründung ergänzen',
      }),
    );
  }

  if (requestedPriceCents !== null && requestedPriceCents < 0) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.EVALUATION_BLOCKED,
        severity: 'blocking',
        category: 'price',
        field: 'requestedUnitPriceCents',
        ruleId: rule?.id ?? null,
        blocking: true,
        internalDescription: 'Negative Preise sind nicht zulässig.',
        salesDescription: 'Der gewünschte Preis ist ungültig.',
        requiredAction: 'Preis korrigieren',
      }),
    );
  }

  let absoluteDeviationCents: number | null = null;
  let percentDeviationTenths: number | null = null;

  if (requestedPriceCents !== null && listPriceCents !== null) {
    absoluteDeviationCents = requestedPriceCents - listPriceCents;
    if (listPriceCents > 0) {
      percentDeviationTenths = Math.round((absoluteDeviationCents * 1000) / listPriceCents);
    }
  }

  if (
    requestedPriceCents !== null &&
    minimumPriceCents !== null &&
    requestedPriceCents < minimumPriceCents
  ) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.PRICE_BELOW_MINIMUM,
        severity: 'error',
        category: 'price',
        field: 'requestedUnitPriceCents',
        ruleId: rule?.id ?? null,
        blocking: false,
        internalDescription: 'Der gewünschte Preis liegt unter dem Mindestpreis.',
        salesDescription: 'Der Preis liegt unter der zulässigen Untergrenze.',
        requiredAction: 'Preis anpassen oder Adminprüfung beantragen',
      }),
    );
  } else if (
    requestedPriceCents !== null &&
    targetPriceCents !== null &&
    requestedPriceCents < targetPriceCents
  ) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.PRICE_BELOW_TARGET,
        severity: 'warning',
        category: 'price',
        field: 'requestedUnitPriceCents',
        ruleId: rule?.id ?? null,
        blocking: false,
        internalDescription: 'Der gewünschte Preis liegt unter dem Zielpreis.',
        salesDescription: 'Der Preis weicht von der Empfehlung ab.',
        requiredAction: 'Begründung prüfen',
      }),
    );
  } else if (
    requestedPriceCents !== null &&
    minimumPriceCents !== null &&
    requestedPriceCents === minimumPriceCents
  ) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.PRICE_AT_MINIMUM,
        severity: 'warning',
        category: 'price',
        field: 'requestedUnitPriceCents',
        ruleId: rule?.id ?? null,
        blocking: false,
        internalDescription: 'Der gewünschte Preis entspricht dem Mindestpreis.',
        salesDescription: 'Der Preis liegt an der unteren Grenze.',
        requiredAction: null,
      }),
    );
  }

  if (
    percentDeviationTenths !== null &&
    maxDiscountPercentTenths !== null &&
    percentDeviationTenths < -maxDiscountPercentTenths
  ) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.DISCOUNT_LIMIT_EXCEEDED,
        severity: 'warning',
        category: 'price',
        field: 'requestedUnitPriceCents',
        ruleId: rule?.id ?? null,
        blocking: false,
        internalDescription: 'Der maximale empfohlene Nachlass wurde überschritten.',
        salesDescription: 'Der Nachlass überschreitet den empfohlenen Spielraum.',
        requiredAction: 'Preis prüfen',
      }),
    );
  }

  return {
    listPriceCents,
    targetPriceCents,
    minimumPriceCents,
    maxDiscountPercentTenths,
    requestedPriceCents,
    evaluatedPriceCents,
    absoluteDeviationCents,
    percentDeviationTenths,
    findings,
  };
}

function classifyReview(findings: PricingFinding[], termIsSpecial: boolean): PricingReviewClass {
  if (termIsSpecial) {
    return 'critical';
  }

  if (findings.some((finding) => finding.blocking || finding.severity === 'blocking')) {
    return 'critical';
  }

  if (
    findings.some(
      (finding) =>
        finding.code === PRICING_FINDING_CODES.PRICE_BELOW_MINIMUM ||
        finding.code === PRICING_FINDING_CODES.PRICE_RULE_NOT_FOUND ||
        finding.code === PRICING_FINDING_CODES.PRICE_RULE_AMBIGUOUS ||
        finding.code === PRICING_FINDING_CODES.PRICE_RULE_CONFLICT ||
        finding.code === PRICING_FINDING_CODES.PRICE_BOOK_NOT_FOUND ||
        finding.code === PRICING_FINDING_CODES.EVALUATION_BLOCKED,
    )
  ) {
    return 'critical';
  }

  if (
    findings.some(
      (finding) =>
        finding.severity === 'warning' ||
        finding.severity === 'error' ||
        finding.code === PRICING_FINDING_CODES.PRICE_BELOW_TARGET ||
        finding.code === PRICING_FINDING_CODES.DISCOUNT_LIMIT_EXCEEDED,
    )
  ) {
    return 'attention';
  }

  return 'standard';
}

function buildApprovalPreparation(
  reviewClass: PricingReviewClass,
  findings: PricingFinding[],
  priceSummary: string,
  termSummary: string,
  configurationSummary: string,
): ApprovalPreparation {
  const blocking = findings.some((finding) => finding.blocking);
  const unreliableEvaluation = findings.some(
    (finding) =>
      finding.blocking ||
      finding.code === PRICING_FINDING_CODES.PRICE_BOOK_NOT_FOUND ||
      finding.code === PRICING_FINDING_CODES.PRICE_RULE_NOT_FOUND ||
      finding.code === PRICING_FINDING_CODES.PRICE_RULE_AMBIGUOUS ||
      finding.code === PRICING_FINDING_CODES.PRICE_RULE_CONFLICT ||
      finding.code === PRICING_FINDING_CODES.EVALUATION_BLOCKED,
  );
  const warnings = findings.filter((finding) => finding.severity === 'warning').map((f) => f.internalDescription);
  const violations = findings.filter((finding) => finding.severity === 'error').map((f) => f.internalDescription);
  const reasons = findings.map((finding) => finding.internalDescription);

  const quickReviewPossible =
    reviewClass === 'standard' &&
    !blocking &&
    !findings.some((finding) => finding.code === PRICING_FINDING_CODES.SPECIAL_TERM_REQUESTED);

  return {
    reviewClass,
    adminReviewRequired: true,
    quickReviewPossible,
    detailReviewRequired: !quickReviewPossible,
    approvalBlocked: blocking || unreliableEvaluation,
    requiredAdminRole: 'admin',
    reasons,
    warnings,
    violations,
    requiredJustifications: findings
      .filter((finding) => finding.requiredAction?.includes('Begründung'))
      .map((finding) => finding.internalDescription),
    priceSummary,
    termSummary,
    configurationSummary,
    internalRecommendation: quickReviewPossible
      ? 'Standardangebot – Schnellprüfung möglich, Adminfreigabe dennoch erforderlich.'
      : 'Detailprüfung durch Admin erforderlich.',
  };
}

export function evaluatePricing(
  input: PricingEvaluationInput,
  catalog: PricingCatalogContext,
): PricingEvaluationResult {
  const evaluatedAt = new Date().toISOString();
  const evaluationId = generateId('pricing_eval');
  const findings: PricingFinding[] = [];

  const versionResolution = resolvePublishedPriceBookVersion(
    catalog.priceBookVersions,
    input.evaluationDate,
  );

  let priceBookVersion: PriceBookVersion | null = versionResolution.version;

  if (versionResolution.ambiguous) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.PRICE_BOOK_NOT_FOUND,
        severity: 'blocking',
        category: 'configuration',
        field: 'evaluationDate',
        ruleId: null,
        blocking: true,
        internalDescription: 'Mehrere gleichwertige veröffentlichte Preislistenversionen am Stichtag.',
        salesDescription: 'Die Preisgrundlage ist derzeit nicht eindeutig.',
        requiredAction: 'Admin kontaktieren',
      }),
    );
    priceBookVersion = null;
  } else if (!priceBookVersion) {
    findings.push(
      createFinding({
        code: PRICING_FINDING_CODES.PRICE_BOOK_NOT_FOUND,
        severity: 'blocking',
        category: 'configuration',
        field: 'evaluationDate',
        ruleId: null,
        blocking: true,
        internalDescription: 'Keine veröffentlichte gültige Preislistenversion am Stichtag.',
        salesDescription: 'Für diesen Stichtag liegt keine gültige Preisgrundlage vor.',
        requiredAction: 'Admin kontaktieren',
      }),
    );
  }

  const termEvaluation = evaluateContractTerm(input, catalog.contractTerms);
  findings.push(...termEvaluation.findings);

  let selectedRules: ReturnType<typeof selectPriceRules> = {
    selectedRules: [],
    rejectedRules: [],
    ambiguous: false,
    conflicting: false,
  };

  if (priceBookVersion) {
    selectedRules = selectPriceRules(catalog.priceRules, priceBookVersion.id, input);

    if (selectedRules.conflicting || selectedRules.ambiguous) {
      findings.push(
        createFinding({
          code: PRICING_FINDING_CODES.PRICE_RULE_AMBIGUOUS,
          severity: 'blocking',
          category: 'rule_conflict',
          field: null,
          ruleId: null,
          blocking: true,
          internalDescription: 'Mehrdeutige oder widersprüchliche Preisregeln.',
          salesDescription: 'Die Preisregeln sind nicht eindeutig.',
          requiredAction: 'Admin kontaktieren',
        }),
      );
    } else if (selectedRules.selectedRules.length === 0) {
      findings.push(
        createFinding({
          code: PRICING_FINDING_CODES.PRICE_RULE_NOT_FOUND,
          severity: 'blocking',
          category: 'configuration',
          field: null,
          ruleId: null,
          blocking: true,
          internalDescription: 'Keine passende Preisregel gefunden.',
          salesDescription: 'Für diese Kombination liegt keine Preisregel vor.',
          requiredAction: 'Konfiguration prüfen',
        }),
      );
    }
  }

  const primaryRule = mergePrimaryRule(selectedRules.selectedRules);
  const priceEvaluation = evaluatePriceBounds(input, primaryRule);
  findings.push(...priceEvaluation.findings);

  const reviewClass = classifyReview(findings, termEvaluation.isSpecialTerm);

  const priceSummary = [
    priceEvaluation.listPriceCents !== null ? `Listenpreis vorhanden` : 'Listenpreis fehlt',
    priceEvaluation.targetPriceCents !== null ? `Zielpreis vorhanden` : 'Zielpreis fehlt',
    priceEvaluation.minimumPriceCents !== null ? `Mindestpreis vorhanden` : 'Mindestpreis fehlt',
  ].join('; ');

  const termSummary = termEvaluation.isSpecialTerm
    ? `Sonderlaufzeit ${termEvaluation.termMonths ?? '?'} Monate`
    : termEvaluation.termMonths !== null
      ? `Standardlaufzeit ${termEvaluation.termMonths} Monate`
      : 'Keine Laufzeit';

  const configurationSummary = priceBookVersion
    ? `Preisliste V${priceBookVersion.versionNumber}`
    : 'Keine gültige Preisliste';

  const approval = buildApprovalPreparation(
    reviewClass,
    findings,
    priceSummary,
    termSummary,
    configurationSummary,
  );

  const snapshot: PricingEvaluationSnapshot = {
    schemaVersion: PRICING_EVALUATION_SNAPSHOT_SCHEMA_VERSION,
    engineVersion: PRICING_ENGINE_VERSION,
    evaluatedAt,
    input,
    priceBookVersionId: priceBookVersion?.id ?? null,
    priceBookVersionNumber: priceBookVersion?.versionNumber ?? null,
    contractTermMonths: termEvaluation.termMonths,
    appliedRuleIds: selectedRules.selectedRules.map((rule) => rule.id),
    rejectedRuleIds: selectedRules.rejectedRules.map((rule) => rule.id),
    positions: [],
    findings,
    reviewClass,
  };

  return {
    evaluationId,
    evaluatedAt,
    engineVersion: PRICING_ENGINE_VERSION,
    inputFingerprint: createPricingEvaluationFingerprint(input),
    priceBookVersionId: priceBookVersion?.id ?? null,
    priceBookVersionNumber: priceBookVersion?.versionNumber ?? null,
    appliedRules: selectedRules.selectedRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
    })),
    rejectedRules: selectedRules.rejectedRules,
    listPriceCents: priceEvaluation.listPriceCents,
    targetPriceCents: priceEvaluation.targetPriceCents,
    minimumPriceCents: priceEvaluation.minimumPriceCents,
    maxDiscountPercentTenths: priceEvaluation.maxDiscountPercentTenths,
    recommendedPriceCents: priceEvaluation.targetPriceCents ?? priceEvaluation.listPriceCents,
    requestedPriceCents: priceEvaluation.requestedPriceCents,
    evaluatedPriceCents: priceEvaluation.evaluatedPriceCents,
    absoluteDeviationCents: priceEvaluation.absoluteDeviationCents,
    percentDeviationTenths: priceEvaluation.percentDeviationTenths,
    currency: input.currency,
    unit: primaryRule?.unit ?? 'monthly',
    termMonths: termEvaluation.termMonths,
    isStandardTerm: termEvaluation.isStandardTerm,
    isSpecialTerm: termEvaluation.isSpecialTerm,
    termAllowed: termEvaluation.termAllowed,
    specialTermReason: input.specialTermReason,
    reviewClass,
    approval,
    findings,
    snapshot,
    stale: false,
  };
}
