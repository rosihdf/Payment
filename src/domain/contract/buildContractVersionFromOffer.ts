import type { OfferItem } from '../offer/offer';
import type { OfferVersion } from '../offer/offerVersion';
import type { ContractHardwareLine, ContractVersionSnapshot } from './contractVersion';
import { CURRENT_CONTRACT_VERSION_SCHEMA_VERSION } from './contractVersion';
import { computeContractEndDate, toIsoDateOnly } from './contractDates';

function mapHardware(lines: OfferItem[], startDate: string | null): ContractHardwareLine[] {
  return lines.map((line) => {
    const mobility =
      /mobil/i.test(line.name) || /mobil/i.test(line.description ?? '')
        ? 'mobile'
        : /station/i.test(line.name)
          ? 'stationary'
          : 'unknown';
    const acquisition =
      line.priceType === 'monthly'
        ? 'rental'
        : line.priceType === 'one_time'
          ? 'purchase'
          : 'unknown';
    return {
      productId: line.productSnapshot?.productId ?? null,
      productName: line.name,
      model: line.productSnapshot?.modelName ?? line.name,
      quantity: line.quantity,
      mobility,
      acquisition,
      activationStatus: 'pending',
      serialNumber: null,
      validFrom: startDate,
      validTo: null,
      unitPriceCents: line.unitPriceCents,
    };
  });
}

export function buildContractVersionSnapshotFromOfferVersion(
  offerVersion: OfferVersion,
  options: {
    startDate?: string | null;
    expectedCommissionCents?: number | null;
    commissionCaseId?: string | null;
  } = {},
): ContractVersionSnapshot {
  const snapshot = offerVersion.snapshot;
  const termMonths = snapshot.termMonths ?? snapshot.tariffSnapshot?.contractDurationMonths ?? null;
  const noticePeriodMonths = snapshot.tariffSnapshot?.noticePeriodMonths ?? null;
  const startDate = options.startDate ?? toIsoDateOnly(new Date());
  const endDate =
    termMonths && startDate ? computeContractEndDate(startDate, termMonths) : null;

  return {
    schemaVersion: CURRENT_CONTRACT_VERSION_SCHEMA_VERSION,
    customerSnapshot: structuredClone(snapshot.customerSnapshot),
    tariffSnapshot: snapshot.tariffSnapshot ? structuredClone(snapshot.tariffSnapshot) : null,
    contractModel: snapshot.contractModel,
    termMonths,
    startDate,
    endDate,
    noticePeriodMonths,
    autoRenewal: Boolean(noticePeriodMonths && noticePeriodMonths > 0),
    renewalMonths: termMonths,
    terminalCount: snapshot.terminalCount,
    terminalLines: structuredClone(snapshot.terminalLines),
    accessoryLines: structuredClone(snapshot.accessoryLines),
    hardware: mapHardware(snapshot.terminalLines, startDate),
    fees: {
      monthlyFeeCents: snapshot.totals.monthlyTotalCents,
      setupFeeCents: snapshot.totals.oneTimeTotalCents,
      transactionFeeNote: null,
      clearingNote: null,
      discountNote: null,
    },
    optionalItems: structuredClone(
      snapshot.items.filter((item) => item.priceType === 'on_request'),
    ),
    totals: structuredClone(snapshot.totals),
    priceBookVersion: snapshot.priceBookVersion,
    commissionReferenceId: options.commissionCaseId ?? snapshot.commissionReferenceId,
    expectedCommissionCents: options.expectedCommissionCents ?? null,
    sourceOfferId: snapshot.offerId,
    sourceOfferVersionId: offerVersion.id,
    sourceOfferNumber: snapshot.offerNumber,
    activationNote: null,
  };
}
