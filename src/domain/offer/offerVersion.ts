import type { OfferRecommendationLink } from '../recommendation/recommendationRecord';
import type { OfferWorkflowStatus } from './offerWorkflow';
import type { OfferContractModel } from './offerContractModel';
import type {
  OfferCustomerSnapshot,
  OfferItem,
  OfferTariffSnapshot,
  OfferTotals,
} from './offer';

export const CURRENT_OFFER_VERSION_SCHEMA_VERSION = 1;

export interface OfferVersionSnapshot {
  schemaVersion: number;
  offerId: string;
  offerNumber: string;
  versionNumber: number;
  leadId: string;
  customerSnapshot: OfferCustomerSnapshot;
  tariffSnapshot: OfferTariffSnapshot | null;
  items: OfferItem[];
  title: string;
  introductionText: string;
  internalNotes: string;
  customerNotes: string;
  validUntil: string | null;
  recommendationLink: OfferRecommendationLink;
  totals: OfferTotals;
  sourceComparisonSessionId: string | null;
  sourceScenarioId: string | null;
  contractModel: OfferContractModel;
  termMonths: number | null;
  terminalCount: number;
  optionalTerminalCount: number;
  terminalLines: OfferItem[];
  accessoryLines: OfferItem[];
  priceBookVersion: string | null;
  commissionReferenceId: string | null;
  approvalRequired: boolean;
  approvalReasons: string[];
  costBaselineId: string | null;
  savingsCents: number | null;
  createdByUserId: string;
  createdAt: string;
}

export interface OfferVersion {
  id: string;
  offerId: string;
  versionNumber: number;
  workflowStatus: OfferWorkflowStatus;
  snapshot: OfferVersionSnapshot;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
  approvedAt: string | null;
  approvedByUserId: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  activatedAt: string | null;
  supersededAt: string | null;
}

export interface OfferVersionDiffEntry {
  field: string;
  label: string;
  before: string;
  after: string;
  approvalRelevant: boolean;
}
