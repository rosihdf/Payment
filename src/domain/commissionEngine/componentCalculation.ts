import type { CommissionRule } from '../commission/commissionRule';
import type { CommissionComponent } from '../commission/commissionCalculation';
import type { CommissionCalculationInput } from '../commission/commissionCalculationInput';
import { generateId } from '../../utils/id';
import { transactionCostsFromTenthsOfCent } from '../../utils/tenthsOfCent';

function buildComponent(
  partial: Omit<CommissionComponent, 'id' | 'sortOrder'> & { sortOrder?: number },
  sortOrder: number,
): CommissionComponent {
  return {
    id: generateId('commission_component'),
    sortOrder,
    ...partial,
  };
}

export function calculateCommissionComponents(
  rules: CommissionRule[],
  input: CommissionCalculationInput,
): CommissionComponent[] {
  const components: CommissionComponent[] = [];
  let sortOrder = 0;

  for (const rule of rules) {
    sortOrder += 1;

    if (rule.calculationBasis === 'fixed_amount') {
      const amount = rule.fixedAmountCents ?? 0;
      components.push(
        buildComponent(
          {
            commissionRuleId: rule.id,
            commissionType: rule.commissionType,
            label: rule.name,
            calculationBasis: rule.calculationBasis,
            basisValueCents: amount,
            basisValueTenthsOfCent: null,
            thresholdTenthsOfCent: null,
            percentTenthsOfBasisPoint: null,
            quantity: 1,
            unitAmountCents: amount,
            totalAmountCents: amount,
            currency: rule.currency,
            isProvisional: false,
            isCalculable: rule.fixedAmountCents !== null,
            missingDataRequirement: rule.fixedAmountCents === null ? 'Fixbetrag fehlt' : null,
            isPositive: amount >= 0,
            internalExplanation: rule.internalDescription || `Fixprovision ${rule.name}`,
          },
          sortOrder,
        ),
      );
      continue;
    }

    if (rule.calculationBasis === 'percentage_of_sale_price') {
      if (rule.accessoryOnly) {
        for (const item of input.accessoryItems) {
          if (item.salePriceCents === null || item.salePriceCents < 0) {
            components.push(
              buildComponent(
                {
                  commissionRuleId: rule.id,
                  commissionType: rule.commissionType,
                  label: `${rule.name} (${item.productId})`,
                  calculationBasis: rule.calculationBasis,
                  basisValueCents: item.salePriceCents,
                  basisValueTenthsOfCent: null,
                  thresholdTenthsOfCent: null,
                  percentTenthsOfBasisPoint: rule.percentTenthsOfBasisPoint,
                  quantity: item.quantity,
                  unitAmountCents: null,
                  totalAmountCents: 0,
                  currency: rule.currency,
                  isProvisional: false,
                  isCalculable: false,
                  missingDataRequirement: 'Verkaufspreis fehlt oder ungültig',
                  isPositive: true,
                  internalExplanation: 'Zubehörprovision benötigt gültigen Verkaufspreis',
                },
                sortOrder,
              ),
            );
            continue;
          }

          const lineTotal = item.salePriceCents * item.quantity;
          const commission = Math.round(
            (lineTotal * (rule.percentTenthsOfBasisPoint ?? 0)) / 10000,
          );

          components.push(
            buildComponent(
              {
                commissionRuleId: rule.id,
                commissionType: rule.commissionType,
                label: `${rule.name} (${item.productId})`,
                calculationBasis: rule.calculationBasis,
                basisValueCents: item.salePriceCents,
                basisValueTenthsOfCent: null,
                thresholdTenthsOfCent: null,
                percentTenthsOfBasisPoint: rule.percentTenthsOfBasisPoint,
                quantity: item.quantity,
                unitAmountCents: item.quantity > 0 ? Math.round(commission / item.quantity) : 0,
                totalAmountCents: commission,
                currency: rule.currency,
                isProvisional: false,
                isCalculable: true,
                missingDataRequirement: null,
                isPositive: commission >= 0,
                internalExplanation: `${rule.percentTenthsOfBasisPoint ?? 0} Zehntel-Basispunkte vom Verkaufspreis`,
              },
              sortOrder,
            ),
          );
        }
        continue;
      }

      const salePrice = input.pricingEvaluationResult.requestedPriceCents ?? 0;
      const commission = Math.round((salePrice * (rule.percentTenthsOfBasisPoint ?? 0)) / 10000);
      components.push(
        buildComponent(
          {
            commissionRuleId: rule.id,
            commissionType: rule.commissionType,
            label: rule.name,
            calculationBasis: rule.calculationBasis,
            basisValueCents: salePrice,
            basisValueTenthsOfCent: null,
            thresholdTenthsOfCent: null,
            percentTenthsOfBasisPoint: rule.percentTenthsOfBasisPoint,
            quantity: 1,
            unitAmountCents: commission,
            totalAmountCents: commission,
            currency: rule.currency,
            isProvisional: false,
            isCalculable: true,
            missingDataRequirement: null,
            isPositive: commission >= 0,
            internalExplanation: rule.internalDescription,
          },
          sortOrder,
        ),
      );
      continue;
    }

    if (
      rule.calculationBasis === 'percentage_above_threshold' ||
      rule.calculationBasis === 'percentage_of_full_fee'
    ) {
      const transactionCount = input.pricingEvaluationResult.snapshot.input.transactionCount;
      const percent = rule.percentTenthsOfBasisPoint ?? 0;
      const threshold = rule.thresholdTenthsOfCent;

      if (transactionCount === null || transactionCount < 0) {
        components.push(
          buildComponent(
            {
              commissionRuleId: rule.id,
              commissionType: rule.commissionType,
              label: rule.name,
              calculationBasis: rule.calculationBasis,
              basisValueCents: null,
              basisValueTenthsOfCent: threshold,
              thresholdTenthsOfCent: threshold,
              percentTenthsOfBasisPoint: percent,
              quantity: 0,
              unitAmountCents: null,
              totalAmountCents: 0,
              currency: rule.currency,
              isProvisional: true,
              isCalculable: false,
              missingDataRequirement: 'Transaktionsmenge oder Abrechnungsdaten fehlen',
              isPositive: true,
              internalExplanation: rule.internalDescription,
            },
            sortOrder,
          ),
        );
        continue;
      }

      if (rule.calculationBasis === 'percentage_of_full_fee' && threshold !== null) {
        const total = transactionCostsFromTenthsOfCent(transactionCount, threshold);
        const commission = Math.round((total * percent) / 10000);
        components.push(
          buildComponent(
            {
              commissionRuleId: rule.id,
              commissionType: rule.commissionType,
              label: rule.name,
              calculationBasis: rule.calculationBasis,
              basisValueCents: total,
              basisValueTenthsOfCent: threshold,
              thresholdTenthsOfCent: threshold,
              percentTenthsOfBasisPoint: percent,
              quantity: transactionCount,
              unitAmountCents: null,
              totalAmountCents: commission,
              currency: rule.currency,
              isProvisional: false,
              isCalculable: true,
              missingDataRequirement: null,
              isPositive: commission >= 0,
              internalExplanation: 'Prozent der gesamten Gebühr',
            },
            sortOrder,
          ),
        );
        continue;
      }

      if (rule.calculationBasis === 'percentage_above_threshold' && threshold !== null) {
        const actualFeeTenths = threshold + 1;
        const diff = Math.max(0, actualFeeTenths - threshold);
        const commissionTenths = Math.round((transactionCount * diff * percent) / 10000);
        const commissionCents = Math.round(commissionTenths / 10);
        components.push(
          buildComponent(
            {
              commissionRuleId: rule.id,
              commissionType: rule.commissionType,
              label: rule.name,
              calculationBasis: rule.calculationBasis,
              basisValueCents: null,
              basisValueTenthsOfCent: actualFeeTenths,
              thresholdTenthsOfCent: threshold,
              percentTenthsOfBasisPoint: percent,
              quantity: transactionCount,
              unitAmountCents: null,
              totalAmountCents: commissionCents,
              currency: rule.currency,
              isProvisional: true,
              isCalculable: actualFeeTenths > threshold,
              missingDataRequirement:
                actualFeeTenths <= threshold
                  ? 'Verkaufssatz liegt auf oder unter der Schwelle'
                  : 'Tatsächlicher Verkaufssatz aus Angebot/Abrechnung erforderlich',
              isPositive: commissionCents >= 0,
              internalExplanation: 'Prozent nur oberhalb der Schwelle',
            },
            sortOrder,
          ),
        );
      }
      continue;
    }

    components.push(
      buildComponent(
        {
          commissionRuleId: rule.id,
          commissionType: rule.commissionType,
          label: rule.name,
          calculationBasis: rule.calculationBasis,
          basisValueCents: null,
          basisValueTenthsOfCent: null,
          thresholdTenthsOfCent: rule.thresholdTenthsOfCent,
          percentTenthsOfBasisPoint: rule.percentTenthsOfBasisPoint,
          quantity: 1,
          unitAmountCents: null,
          totalAmountCents: 0,
          currency: rule.currency,
          isProvisional: true,
          isCalculable: false,
          missingDataRequirement: 'Externe oder unvollständige Berechnungsbasis',
          isPositive: true,
          internalExplanation: rule.internalDescription,
        },
        sortOrder,
      ),
    );
  }

  return components;
}

export function aggregateCommissionAmounts(components: CommissionComponent[]): {
  baseCommissionAmountCents: number;
  provisionalRecurringAmountCents: number;
  confirmedRecurringAmountCents: number;
  accessoryCommissionAmountCents: number;
  bonusAmountCents: number;
  malusAmountCents: number;
  originalCommissionAmountCents: number;
} {
  let baseCommissionAmountCents = 0;
  let provisionalRecurringAmountCents = 0;
  let confirmedRecurringAmountCents = 0;
  let accessoryCommissionAmountCents = 0;
  let bonusAmountCents = 0;
  let malusAmountCents = 0;

  for (const component of components) {
    if (!component.isCalculable) {
      if (component.isProvisional && component.commissionType !== 'accessory') {
        provisionalRecurringAmountCents += component.totalAmountCents;
      }
      continue;
    }

    const signed = component.isPositive ? component.totalAmountCents : -component.totalAmountCents;

    switch (component.commissionType) {
      case 'base_once':
      case 'hardware':
        baseCommissionAmountCents += signed;
        break;
      case 'accessory':
        accessoryCommissionAmountCents += signed;
        break;
      case 'transaction_share':
      case 'clearing_share':
      case 'terminal_share':
      case 'girocard_share':
      case 'recurring':
        if (component.isProvisional) {
          provisionalRecurringAmountCents += signed;
        } else {
          confirmedRecurringAmountCents += signed;
        }
        break;
      case 'bonus':
        bonusAmountCents += signed;
        break;
      case 'malus':
      case 'clawback':
        malusAmountCents += Math.abs(signed);
        break;
      default:
        baseCommissionAmountCents += signed;
    }
  }

  const originalCommissionAmountCents =
    baseCommissionAmountCents +
    confirmedRecurringAmountCents +
    accessoryCommissionAmountCents +
    bonusAmountCents -
    malusAmountCents;

  return {
    baseCommissionAmountCents,
    provisionalRecurringAmountCents,
    confirmedRecurringAmountCents,
    accessoryCommissionAmountCents,
    bonusAmountCents,
    malusAmountCents,
    originalCommissionAmountCents: Math.max(0, originalCommissionAmountCents),
  };
}
