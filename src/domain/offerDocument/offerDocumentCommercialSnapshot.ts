import type { CommercialDeploymentMode } from '../commercial/commercialConfig';
import type { CommercialProjectionBreakdown } from '../commercial/calculateCommercialProjection';
import { FLAT_MARKUP_RULES } from '../commercial/commercialMarkupCatalog';
import { getCommercialTermOptions } from '../commercial/commercialTermCapability';
import type { Tariff } from '../tariff/tariff';
import {
  isFrozenCommercialSnapshot,
  type OfferCommercialSnapshot,
} from '../offer/offerCommercialSnapshot';
import {
  OFFER_DOCUMENT_FLAT_MARKUP_DISCLOSURES,
  OFFER_DOCUMENT_PROJECTION_BASIS_NOTE,
} from './offerDocumentDefaults';

export interface OfferDocumentCommercialNeedBasis {
  monthlyCardVolumeCents: number | null;
  monthlyTransactions: number | null;
  cardMixSummary: string | null;
}

/** Kundenseitige, eingefrorene Commercial-Daten für PDF – ohne Provision. */
export interface OfferDocumentCommercialSnapshot {
  tariffName: string;
  productName: string | null;
  terminalModel: string;
  deploymentMode: CommercialDeploymentMode;
  deploymentLabel: string;
  contractTermMonths: number;
  terminalCount: number;
  transactionFeeTenthsOfCent: number;
  girocardClearingIncluded: boolean;
  girocardClearingFeeTenthsOfCent: number;
  cardRates: Tariff['cardRates'];
  breakdown: CommercialProjectionBreakdown;
  needBasis: OfferDocumentCommercialNeedBasis;
  projectionAssumptions: string[];
  customerDisclosures: string[];
  flatMarkupDisclosures: string[];
  fairnessGuaranteeNote: string | null;
}

const DEPLOYMENT_LABELS: Record<CommercialDeploymentMode, string> = {
  stationary_wifi: 'Stationär über Kunden-WLAN – kein SIM-Aufpreis',
  mobile_sim: 'Mobil mit SIM/Mobilfunk – monatlicher SIM-Aufpreis gemäß Angebot',
};

function formatCardMixSummary(
  cardMix: {
    girocardPercent: number | null;
    debitPercent: number | null;
    creditPercent: number | null;
    otherPercent: number | null;
  },
): string | null {
  const parts = [
    cardMix.girocardPercent !== null ? `Girocard ${cardMix.girocardPercent} %` : null,
    cardMix.debitPercent !== null ? `Debit ${cardMix.debitPercent} %` : null,
    cardMix.creditPercent !== null ? `Kredit ${cardMix.creditPercent} %` : null,
    cardMix.otherPercent !== null && cardMix.otherPercent > 0
      ? `Sonstige ${cardMix.otherPercent} %`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : null;
}

function buildFlatMarkupDisclosures(tariffProductCode: string): string[] {
  if (!tariffProductCode.toUpperCase().includes('FLAT')) {
    return [];
  }

  return FLAT_MARKUP_RULES.map(
    (rule) =>
      `${rule.label} (+${(rule.markupTenthsOfBasisPoint / 1000).toFixed(2).replace('.', ',')} %) – ${rule.sourceReference}`,
  );
}

function resolveFairnessGuaranteeNote(productId: string | null): string | null {
  const reference = getCommercialTermOptions(productId).termSourceReference;
  if (!reference.includes('Fairnessgarantie')) {
    return null;
  }

  return reference;
}

export function buildOfferDocumentCommercialSnapshot(
  commercial: OfferCommercialSnapshot,
): OfferDocumentCommercialSnapshot {
  const { identity, commercialConfig, projection, needSnapshot } = commercial;
  const flatMarkupDisclosures = buildFlatMarkupDisclosures(commercialConfig.tariffProductCode);

  const customerDisclosures = [OFFER_DOCUMENT_PROJECTION_BASIS_NOTE];
  if (flatMarkupDisclosures.length > 0) {
    customerDisclosures.push(...OFFER_DOCUMENT_FLAT_MARKUP_DISCLOSURES);
  }

  return {
    tariffName: identity.tariffName,
    productName: identity.productName,
    terminalModel: identity.terminalModel,
    deploymentMode: identity.deploymentMode,
    deploymentLabel: DEPLOYMENT_LABELS[identity.deploymentMode],
    contractTermMonths: identity.contractTermMonths,
    terminalCount: identity.terminalCount,
    transactionFeeTenthsOfCent: commercialConfig.additionalTransactionFeeTenthsOfCent,
    girocardClearingIncluded: commercialConfig.girocardClearingIncluded,
    girocardClearingFeeTenthsOfCent: commercialConfig.girocardClearingFeeTenthsOfCent,
    cardRates: commercialConfig.cardRates,
    breakdown: { ...projection.breakdown },
    needBasis: {
      monthlyCardVolumeCents: needSnapshot.monthlyCardVolumeCents,
      monthlyTransactions: needSnapshot.monthlyTransactions,
      cardMixSummary: formatCardMixSummary(needSnapshot.cardMix),
    },
    projectionAssumptions: [...projection.assumptions],
    customerDisclosures,
    flatMarkupDisclosures,
    fairnessGuaranteeNote: resolveFairnessGuaranteeNote(identity.productId),
  };
}

export function resolveOfferDocumentCommercialSnapshot(
  commercial: OfferCommercialSnapshot | null | undefined,
): OfferDocumentCommercialSnapshot | null {
  if (!isFrozenCommercialSnapshot(commercial)) {
    return null;
  }

  return buildOfferDocumentCommercialSnapshot(commercial);
}
