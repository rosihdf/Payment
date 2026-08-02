import {
  SALES_DOCUMENT_TYPE_LABELS,
  type SalesDocument,
} from '../domain/salesDocument/salesDocument';
import type { OfferDocument } from '../domain/offerDocument/offerDocument';
import type { ActivationCaseRepository } from '../repositories/interfaces/ActivationCaseRepository';
import type { ContractRepository } from '../repositories/interfaces/ContractRepository';
import type { OfferDocumentRepository } from '../repositories/interfaces/OfferDocumentRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { SalesDocumentRepository } from '../repositories/interfaces/SalesDocumentRepository';

export type CustomerDocumentSource = 'sales_document' | 'offer_document';

/** Aggregierte Dokument-Metadaten je Kunde – kein DMS, kein Upload. */
export interface CustomerDocumentRef {
  id: string;
  source: CustomerDocumentSource;
  leadId: string;
  typeKey: string;
  typeLabel: string;
  fileName: string;
  createdAt: string;
  offerId: string | null;
  contractId: string | null;
  activationId: string | null;
  /** Nur wenn echte Metadaten vorliegen (z. B. Angebotsdokument-Version). */
  versionNumber: number | null;
}

function salesDocRef(document: SalesDocument, leadId: string): CustomerDocumentRef {
  return {
    id: document.id,
    source: 'sales_document',
    leadId,
    typeKey: document.type,
    typeLabel: SALES_DOCUMENT_TYPE_LABELS[document.type] ?? document.type,
    fileName: document.fileName,
    createdAt: document.createdAt,
    offerId: document.offerId,
    contractId: document.contractId,
    activationId: document.activationId,
    versionNumber: null,
  };
}

function offerDocRef(document: OfferDocument, leadId: string): CustomerDocumentRef {
  return {
    id: document.id,
    source: 'offer_document',
    leadId,
    typeKey: 'offer_document',
    typeLabel: document.status === 'generated' ? 'Angebotsdokument' : 'Angebotsdokument (ersetzt)',
    fileName: `${document.documentNumber}.pdf`,
    createdAt: document.createdAt,
    offerId: document.offerId,
    contractId: null,
    activationId: null,
    versionNumber: document.version,
  };
}

export class CustomerDocumentAggregationService {
  private readonly offerRepository: OfferRepository;
  private readonly contractRepository: ContractRepository;
  private readonly activationCaseRepository: ActivationCaseRepository;
  private readonly salesDocumentRepository: SalesDocumentRepository;
  private readonly offerDocumentRepository: OfferDocumentRepository;

  constructor(
    offerRepository: OfferRepository,
    contractRepository: ContractRepository,
    activationCaseRepository: ActivationCaseRepository,
    salesDocumentRepository: SalesDocumentRepository,
    offerDocumentRepository: OfferDocumentRepository,
  ) {
    this.offerRepository = offerRepository;
    this.contractRepository = contractRepository;
    this.activationCaseRepository = activationCaseRepository;
    this.salesDocumentRepository = salesDocumentRepository;
    this.offerDocumentRepository = offerDocumentRepository;
  }

  async listForLead(leadId: string): Promise<CustomerDocumentRef[]> {
    const [offers, contracts, activations, salesDocuments, offerDocuments] = await Promise.all([
      this.offerRepository.getAll(),
      this.contractRepository.getAll(),
      this.activationCaseRepository.getAll(),
      this.salesDocumentRepository.getAll(),
      this.offerDocumentRepository.getAll(),
    ]);

    const offerIds = new Set(
      offers.filter((offer) => offer.leadId === leadId).map((offer) => offer.id),
    );
    const contractIds = new Set(
      contracts.filter((contract) => contract.leadId === leadId).map((contract) => contract.id),
    );
    const activationIds = new Set(
      activations.filter((item) => item.leadId === leadId).map((item) => item.id),
    );

    const refs: CustomerDocumentRef[] = [];

    for (const document of salesDocuments) {
      const matchesOffer = document.offerId !== null && offerIds.has(document.offerId);
      const matchesContract = document.contractId !== null && contractIds.has(document.contractId);
      const matchesActivation =
        document.activationId !== null && activationIds.has(document.activationId);
      if (matchesOffer || matchesContract || matchesActivation) {
        refs.push(salesDocRef(document, leadId));
      }
    }

    for (const document of offerDocuments) {
      if (offerIds.has(document.offerId)) {
        refs.push(offerDocRef(document, leadId));
      }
    }

    const seen = new Set<string>();
    return refs
      .filter((ref) => {
        const key = `${ref.source}:${ref.id}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
