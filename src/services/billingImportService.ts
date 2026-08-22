import type { BillingImportSession } from '../domain/billingImport/billingImportSession';
import { BILLING_IMPORT_ENGINE_VERSION } from '../domain/billingImport/billingImportSession';
import type { BillingSourceDocument } from '../domain/billingImport/billingSourceDocument';
import type { ExtractedBillingField } from '../domain/billingImport/extractedBillingField';
import type { BillingPeriodRecord } from '../domain/billingImport/billingPeriodRecord';
import type { CustomerCostBaseline } from '../domain/billingImport/customerCostBaseline';
import { createBillingFinding, BILLING_FINDING_CODES } from '../domain/billingImport/billingImportFinding';
import { aggregateCustomerCostBaseline } from '../domain/billingImportEngine/billingBaselineAggregation';
import { extractBillingDocument, flattenPages } from '../domain/billingImportEngine/billingDocumentExtraction';
import { fingerprintBillingFileContent } from '../domain/billingImportEngine/billingFileFingerprint';
import { validateBillingFile, BILLING_FILE_LIMITS } from '../domain/billingImportEngine/billingFileValidation';
import { BILLING_FIELD_CODES } from '../domain/billingImport/billingFieldCodes';
import {
  detectBillingFieldCandidates,
  getConfirmedFieldValue,
  resolveFieldConflicts,
} from '../domain/billingImportEngine/billingFieldRecognition';
import { detectBillingDuplicates } from '../domain/billingImportEngine/billingDuplicateDetection';
import { detectBillingOutliers } from '../domain/billingImportEngine/billingOutlierDetection';
import {
  buildBillingPeriodRecordFromFields,
  finalizePeriodMetrics,
} from '../domain/billingImportEngine/billingPeriodBuilder';
import type { BillingCostLineItem, BillingCostLineCategory, BillingCostLineCostType } from '../domain/billingImport/billingCostLineItem';
import { BILLING_OCR_CONFIG } from '../domain/billingImportEngine/billingOcrConfig';
import { isBillingDemoOcrEnabled } from '../config/billingOcrFeature';
import {
  parseFieldInputValue,
  rebuildSessionPeriods,
} from '../domain/billingImportEngine/billingPeriodRecalculation';
import { LazyBrowserOcrExtractionProvider } from '../domain/billingImportEngine/providers/lazyBrowserOcrExtractionProvider';
import {
  cancelSessionExtraction,
  createSessionAbortController,
  getDocumentProgress,
  getDocumentRotation,
  resetDocumentRotation,
  rotateDocumentLeft,
  rotateDocumentRight,
  setDocumentProgress,
} from './billingDocumentSessionState';
import { invalidateOcrCacheForFingerprint } from '../domain/billingImportEngine/billingOcrCache';
import { MockBillingExtractionProvider } from '../domain/billingImportEngine/providers/mockBillingExtractionProvider';
import type { BillingDocumentExtractionProvider } from '../domain/billingImportEngine/providers/billingDocumentExtractionProvider';
import { UnavailableOcrExtractionProvider } from '../domain/billingImportEngine/providers/unavailableOcrExtractionProvider';
import type { Offer } from '../domain/offer/offer';
import type { User } from '../domain/user/user';
import { generateId, nowIso } from '../utils/id';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type {
  BillingImportRepository,
  BillingImportStoreData,
} from '../repositories/interfaces/BillingImportRepository';
import {
  toSalesBillingImportView,
  type SalesBillingImportView,
} from './billingImportViews';
import {
  clearSessionFiles,
  getSessionFilePreviewUrl,
  removeSessionFile,
  storeSessionFile,
} from './billingSessionFileStore';

export interface BillingImportUserContext {
  userId: string;
  role: User['role'];
}

function canAccessOffer(offer: Offer, context: BillingImportUserContext): boolean {
  if (context.role === 'admin') {
    return true;
  }
  return offer.createdByUserId === context.userId;
}

function createProviderRegistry() {
  const lazyOcrProvider = new LazyBrowserOcrExtractionProvider();
  let pdfTextProvider: BillingDocumentExtractionProvider | null = null;

  return {
    getPdfTextProvider: async () => {
      if (!pdfTextProvider) {
        const { PdfTextExtractionProvider } = await import(
          '../domain/billingImportEngine/providers/pdfTextExtractionProvider'
        );
        pdfTextProvider = new PdfTextExtractionProvider();
      }
      return pdfTextProvider;
    },
    getOcrProvider: async () => lazyOcrProvider,
    fallbackOcrProvider: new UnavailableOcrExtractionProvider(),
    demoProvider: new MockBillingExtractionProvider(),
    useDemoProvider: isBillingDemoOcrEnabled(),
  };
}

function detectionMethodFromProvider(providerId: string): ExtractedBillingField['detectionMethod'] {
  if (providerId.includes('mock')) {
    return 'mock';
  }
  if (providerId.includes('ocr')) {
    return 'ocr';
  }
  return 'embedded_text';
}

function buildAggregationExtras(
  sessionId: string,
  documents: BillingSourceDocument[],
  fields: ExtractedBillingField[],
  costLineItems: BillingCostLineItem[],
) {
  const documentRotations = Object.fromEntries(
    documents.map((document) => [document.id, getDocumentRotation(sessionId, document.id)]),
  );
  const selectedCandidateByFieldId = Object.fromEntries(
    fields
      .filter((field) => field.status === 'confirmed' && field.candidateGroupId)
      .map((field) => [field.fieldCode, field.id]),
  );
  const ocrConfidences = fields
    .filter((field) => field.detectionMethod === 'ocr' && field.confidence !== null)
    .map((field) => field.confidence!);
  const meanOcrConfidence =
    ocrConfidences.length > 0
      ? Math.round(ocrConfidences.reduce((sum, value) => sum + value, 0) / ocrConfidences.length)
      : null;

  return {
    costLineItems,
    documentRotations,
    selectedCandidateByFieldId,
    meanOcrConfidence,
    pageExtractionMethods: Object.fromEntries(
      documents.map((document) => [
        document.id,
        document.mimeType === 'application/pdf'
          ? ('mixed' as const)
          : document.extractionStatus === 'failed'
            ? ('ocr' as const)
            : ('ocr' as const),
      ]),
    ),
  };
}

export class BillingImportService {
  private readonly offerRepository: OfferRepository;
  private readonly billingImportRepository: BillingImportRepository;

  constructor(offerRepository: OfferRepository, billingImportRepository: BillingImportRepository) {
    this.offerRepository = offerRepository;
    this.billingImportRepository = billingImportRepository;
  }

  private readStore(): Promise<BillingImportStoreData> {
    return this.billingImportRepository.readStore();
  }

  private writeStore(store: BillingImportStoreData): Promise<void> {
    return this.billingImportRepository.writeStore(store);
  }

  private async getAccessibleOffer(
    offerId: string,
    context: BillingImportUserContext,
  ): Promise<Offer | null> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer || !canAccessOffer(offer, context)) {
      return null;
    }
    return offer;
  }

  async getOrCreateSession(
    offerId: string,
    context: BillingImportUserContext,
  ): Promise<BillingImportSession | null> {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return null;
    }

    const store = await this.readStore();
    const existing = store.sessions
      .filter(
        (session) =>
          session.offerId === offerId &&
          session.salesRepresentativeId === context.userId &&
          session.status !== 'superseded' &&
          session.status !== 'confirmed',
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

    if (existing) {
      return existing;
    }

    const timestamp = nowIso();
    const session: BillingImportSession = {
      id: generateId('billing_import_session'),
      leadId: offer.leadId,
      offerId,
      salesRepresentativeId: context.userId,
      status: 'created',
      fileCount: 0,
      documentCount: 0,
      periodCount: 0,
      inputFingerprint: '',
      engineVersion: BILLING_IMPORT_ENGINE_VERSION,
      internalNote: '',
      createdByUserId: context.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      confirmedByUserId: null,
      confirmedAt: null,
      activeBaselineId: null,
    };

    store.sessions.push(session);
    await this.writeStore(store);
    return session;
  }

  async getOrCreateFreeSession(
    context: BillingImportUserContext,
    options: { leadId?: string | null; existingSessionId?: string | null } = {},
  ): Promise<BillingImportSession | null> {
    const store = await this.readStore();

    if (options.existingSessionId) {
      const existing = store.sessions.find(
        (session) =>
          session.id === options.existingSessionId &&
          session.createdByUserId === context.userId &&
          session.status !== 'superseded',
      );
      if (existing) {
        return existing;
      }
    }

    const timestamp = nowIso();
    const session: BillingImportSession = {
      id: generateId('billing_import_session'),
      leadId: options.leadId ?? null,
      offerId: null,
      salesRepresentativeId: context.userId,
      status: 'created',
      fileCount: 0,
      documentCount: 0,
      periodCount: 0,
      inputFingerprint: '',
      engineVersion: BILLING_IMPORT_ENGINE_VERSION,
      internalNote: 'bestpay_calculator',
      createdByUserId: context.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      confirmedByUserId: null,
      confirmedAt: null,
      activeBaselineId: null,
    };

    store.sessions.push(session);
    await this.writeStore(store);
    return session;
  }

  async getSalesViewForSession(
    sessionId: string,
    context: BillingImportUserContext,
  ): Promise<SalesBillingImportView | null> {
    const data = await this.getSessionData(sessionId, context);
    if (!data) {
      return null;
    }

    return toSalesBillingImportView({
      session: data.session,
      documents: data.documents,
      fields: data.fields,
      periods: data.periods,
      costLineItems: data.costLineItems,
      baseline: data.baseline,
      baselinePreview: data.baselinePreview,
      findings: data.findings,
      recommendationHasBaselineLink: false,
    });
  }

  async addFilesToSession(
    sessionId: string,
    files: File[],
    context: BillingImportUserContext,
  ): Promise<{ ok: true; documents: BillingSourceDocument[] } | { ok: false; errors: string[] }> {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);
    if (!session || session.createdByUserId !== context.userId) {
      return { ok: false, errors: ['not_found'] };
    }

    if (session.fileCount + files.length > BILLING_FILE_LIMITS.maxFilesPerSession) {
      return { ok: false, errors: ['too_many_files'] };
    }

    const documents: BillingSourceDocument[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const validation = validateBillingFile(file);
      if (!validation.ok) {
        errors.push(...validation.errors);
        continue;
      }

      const content = await file.arrayBuffer();
      const fingerprint = await fingerprintBillingFileContent(content);
      const timestamp = nowIso();
      const document: BillingSourceDocument = {
        id: generateId('billing_document'),
        sessionId,
        originalFileName: file.name,
        mimeType: validation.mimeType,
        fileSizeBytes: file.size,
        pageCount: 0,
        contentFingerprint: fingerprint,
        uploadOrder: session.fileCount + documents.length,
        extractionStatus: 'pending',
        documentType: 'unknown',
        detectedProviderName: null,
        detectedCustomerNumber: null,
        detectedInvoiceNumber: null,
        periodFrom: null,
        periodTo: null,
        currency: null,
        netGrossBasis: 'unknown',
        averageConfidence: null,
        duplicateStatus: 'none',
        duplicateOfDocumentId: null,
        errorMessage: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      storeSessionFile(sessionId, document.id, file);
      documents.push(document);
      store.documents.push(document);
    }

    session.fileCount += documents.length;
    session.documentCount += documents.length;
    session.status = 'uploading';
    session.updatedAt = nowIso();

    const duplicates = detectBillingDuplicates(
      store.documents.filter((document) => document.sessionId === sessionId),
    );
    for (const duplicate of duplicates.exactDuplicates) {
      const document = store.documents.find((entry) => entry.id === duplicate.documentId);
      if (document) {
        document.duplicateStatus = 'exact_duplicate';
        document.duplicateOfDocumentId = duplicate.duplicateOfDocumentId;
      }
    }

    await this.writeStore(store);
    return { ok: true, documents };
  }

  async extractDocument(
    sessionId: string,
    documentId: string,
    context: BillingImportUserContext,
  ): Promise<BillingSourceDocument | null> {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);
    const document = store.documents.find((entry) => entry.id === documentId);
    if (!session || !document || session.createdByUserId !== context.userId) {
      return null;
    }

    const file = (await import('./billingSessionFileStore')).getSessionFile(sessionId, documentId);
    if (!file) {
      document.extractionStatus = 'failed';
      document.errorMessage = 'Originaldatei nicht mehr verfügbar – bitte erneut hochladen.';
      await this.writeStore(store);
      return document;
    }

    document.extractionStatus = 'extracting_text';
    const content = await file.arrayBuffer();
    const abortController = createSessionAbortController(sessionId);
    const rotationDegrees = getDocumentRotation(sessionId, documentId);
    const extraction = await extractBillingDocument(
      {
        documentId,
        fileName: file.name,
        mimeType: document.mimeType,
        content,
        contentFingerprint: document.contentFingerprint,
        rotationDegrees,
        signal: abortController.signal,
        onProgress: (progress) => setDocumentProgress(sessionId, documentId, progress),
      },
      createProviderRegistry(),
    );

    if (abortController.signal.aborted) {
      document.extractionStatus = 'pending';
      document.errorMessage = 'Extraktion abgebrochen.';
      await this.writeStore(store);
      return document;
    }

    if (!extraction.ok) {
      document.extractionStatus = 'failed';
      document.errorMessage = extraction.errorMessage ?? extraction.errorCode ?? 'Extraktion fehlgeschlagen';
      session.status = 'review_required';
      await this.writeStore(store);
      return document;
    }

    const blocks = flattenPages(extraction.pages);
    const method = detectionMethodFromProvider(extraction.providerId);
    const candidates = detectBillingFieldCandidates(documentId, blocks, method);
    const { resolved, conflicts } = resolveFieldConflicts(candidates);

    store.fields = store.fields.filter((field) => field.documentId !== documentId);
    store.fields.push(...candidates);

    document.pageCount = extraction.pages.length;
    document.extractionStatus = conflicts.length > 0 || candidates.some((field) => field.status === 'review_required')
      ? 'review_required'
      : 'review_required';
    document.averageConfidence =
      extraction.pages.reduce((sum, page) => sum + page.averageConfidence, 0) /
      Math.max(extraction.pages.length, 1);
    const providerField = getConfirmedFieldValue(resolved, BILLING_FIELD_CODES.PROVIDER_NAME);
    if (typeof providerField === 'string' && providerField.trim()) {
      document.detectedProviderName = providerField.trim();
    }
    document.updatedAt = nowIso();
    session.status = 'review_required';
    session.updatedAt = nowIso();

    const period = buildBillingPeriodRecordFromFields(sessionId, documentId, resolved);
    if (period) {
      store.periods = store.periods.filter(
        (entry) => !entry.sourceDocumentIds.includes(documentId),
      );
      store.periods.push(finalizePeriodMetrics(period));
      session.periodCount = store.periods.filter((entry) => entry.sessionId === sessionId).length;
    } else {
      this.recalculateSessionPeriods(store, sessionId);
    }

    await this.writeStore(store);
    return document;
  }

  async updateField(
    fieldId: string,
    update: {
      status: ExtractedBillingField['status'];
      correctedValue?: string | number | null;
      comment?: string;
    },
    context: BillingImportUserContext,
  ): Promise<ExtractedBillingField | null> {
    const store = await this.readStore();
    const field = store.fields.find((entry) => entry.id === fieldId);
    if (!field) {
      return null;
    }

    const document = store.documents.find((entry) => entry.id === field.documentId);
    const session = document
      ? store.sessions.find((entry) => entry.id === document.sessionId)
      : null;
    if (!session || session.createdByUserId !== context.userId) {
      return null;
    }

    field.status = update.status;
    if (update.correctedValue !== undefined) {
      field.correctedValue = update.correctedValue;
      field.normalizedValue = update.correctedValue;
    }
    if (update.comment !== undefined) {
      field.comment = update.comment;
    }
    if (update.status === 'corrected' || update.status === 'confirmed') {
      field.correctedByUserId = context.userId;
      field.correctedAt = nowIso();
    }

    const storeAfter = await this.readStore();
    if (document && session) {
      this.recalculateSessionPeriods(storeAfter, session.id);
      await this.writeStore(storeAfter);
    } else {
      await this.writeStore(store);
    }
    return field;
  }

  async correctField(
    fieldId: string,
    rawInput: string,
    context: BillingImportUserContext,
    comment = '',
  ): Promise<ExtractedBillingField | null> {
    const store = await this.readStore();
    const field = store.fields.find((entry) => entry.id === fieldId);
    if (!field) {
      return null;
    }
    const parsed = parseFieldInputValue(field.fieldCode, rawInput);
    if (!parsed.ok) {
      return null;
    }
    return this.updateField(
      fieldId,
      { status: 'corrected', correctedValue: parsed.value, comment },
      context,
    );
  }

  async resetFieldToDetected(
    fieldId: string,
    context: BillingImportUserContext,
  ): Promise<ExtractedBillingField | null> {
    const store = await this.readStore();
    const field = store.fields.find((entry) => entry.id === fieldId);
    if (!field) {
      return null;
    }
    const document = store.documents.find((entry) => entry.id === field.documentId);
    const session = document ? store.sessions.find((entry) => entry.id === document.sessionId) : null;
    if (!session || (session.createdByUserId !== context.userId && context.role !== 'admin')) {
      return null;
    }

    field.normalizedValue = field.originalDetectedValue;
    field.correctedValue = null;
    field.status = field.confidenceClass === 'high' ? 'detected' : 'review_required';
    field.comment = '';
    field.correctedByUserId = null;
    field.correctedAt = null;
    this.recalculateSessionPeriods(store, session.id);
    await this.writeStore(store);
    return field;
  }

  async selectFieldCandidate(
    fieldId: string,
    context: BillingImportUserContext,
  ): Promise<ExtractedBillingField | null> {
    const store = await this.readStore();
    const field = store.fields.find((entry) => entry.id === fieldId);
    if (!field) {
      return null;
    }
    const document = store.documents.find((entry) => entry.id === field.documentId);
    const session = document ? store.sessions.find((entry) => entry.id === document.sessionId) : null;
    if (!session || session.createdByUserId !== context.userId) {
      return null;
    }

    if (field.candidateGroupId) {
      for (const candidate of store.fields.filter(
        (entry) =>
          entry.candidateGroupId === field.candidateGroupId && entry.fieldCode === field.fieldCode,
      )) {
        if (candidate.id === fieldId) {
          candidate.status = 'confirmed';
          candidate.correctedByUserId = context.userId;
          candidate.correctedAt = nowIso();
        } else {
          candidate.status = 'rejected';
        }
      }
    } else {
      field.status = 'confirmed';
      field.correctedByUserId = context.userId;
      field.correctedAt = nowIso();
    }

    this.recalculateSessionPeriods(store, session.id);
    await this.writeStore(store);
    return field;
  }

  async addCostLineItem(
    sessionId: string,
    input: {
      periodId?: string | null;
      documentId?: string | null;
      category: BillingCostLineCategory;
      label: string;
      amountCents: number;
      currency: string;
      costType: BillingCostLineCostType;
      comment?: string;
    },
    context: BillingImportUserContext,
  ): Promise<BillingCostLineItem | null> {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);
    if (!session || session.createdByUserId !== context.userId) {
      return null;
    }

    const timestamp = nowIso();
    const item: BillingCostLineItem = {
      id: generateId('billing_cost_line'),
      sessionId,
      periodId: input.periodId ?? null,
      documentId: input.documentId ?? null,
      category: input.category,
      label: input.label,
      amountCents: input.amountCents,
      currency: input.currency,
      costType: input.costType,
      quantity: null,
      unit: null,
      source: 'manual',
      pageNumber: null,
      included: true,
      comment: input.comment ?? '',
      createdByUserId: context.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.costLineItems.push(item);
    this.recalculateSessionPeriods(store, sessionId);
    await this.writeStore(store);
    return item;
  }

  async updateCostLineItem(
    itemId: string,
    input: Partial<Pick<BillingCostLineItem, 'label' | 'amountCents' | 'category' | 'costType' | 'included' | 'comment'>>,
    context: BillingImportUserContext,
  ): Promise<BillingCostLineItem | null> {
    const store = await this.readStore();
    const item = store.costLineItems.find((entry) => entry.id === itemId);
    if (!item) {
      return null;
    }
    const session = store.sessions.find((entry) => entry.id === item.sessionId);
    if (!session || session.createdByUserId !== context.userId) {
      return null;
    }

    Object.assign(item, input, { updatedAt: nowIso(), source: 'corrected' as const });
    this.recalculateSessionPeriods(store, session.id);
    await this.writeStore(store);
    return item;
  }

  async removeCostLineItem(itemId: string, context: BillingImportUserContext): Promise<boolean> {
    const store = await this.readStore();
    const item = store.costLineItems.find((entry) => entry.id === itemId);
    if (!item) {
      return false;
    }
    const session = store.sessions.find((entry) => entry.id === item.sessionId);
    if (!session || session.createdByUserId !== context.userId) {
      return false;
    }
    store.costLineItems = store.costLineItems.filter((entry) => entry.id !== itemId);
    this.recalculateSessionPeriods(store, session.id);
    await this.writeStore(store);
    return true;
  }

  async cancelExtraction(sessionId: string, context: BillingImportUserContext): Promise<boolean> {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);
    if (!session || session.createdByUserId !== context.userId) {
      return false;
    }
    cancelSessionExtraction(sessionId);
    return true;
  }

  async rotateDocument(sessionId: string, documentId: string, direction: 'left' | 'right' | 'reset', context: BillingImportUserContext): Promise<number> {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);
    const document = store.documents.find((entry) => entry.id === documentId);
    if (!session || !document || session.createdByUserId !== context.userId) {
      return 0;
    }
    invalidateOcrCacheForFingerprint(document.contentFingerprint);
    if (direction === 'left') {
      return rotateDocumentLeft(sessionId, documentId);
    }
    if (direction === 'right') {
      return rotateDocumentRight(sessionId, documentId);
    }
    resetDocumentRotation(sessionId, documentId);
    return 0;
  }

  async computeBaselinePreview(sessionId: string, context: BillingImportUserContext): Promise<CustomerCostBaseline | null> {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);
    if (!session || (session.createdByUserId !== context.userId && context.role !== 'admin')) {
      return null;
    }

    const documents = store.documents.filter((document) => document.sessionId === sessionId);
    const fields = store.fields.filter((field) =>
      documents.some((document) => document.id === field.documentId),
    );
    const periods = store.periods.filter((period) => period.sessionId === sessionId);
    const costLineItems = store.costLineItems.filter((item) => item.sessionId === sessionId);

    return aggregateCustomerCostBaseline({
      sessionId,
      leadId: session.leadId,
      offerId: session.offerId,
      documents,
      fields,
      periods,
      confirmedByUserId: context.userId,
      providerIds: [BILLING_OCR_CONFIG.providerId, 'pdf_text_extraction'],
      providerVersions: {
        ocr: BILLING_OCR_CONFIG.providerVersion,
        pdf: '1.1.0',
      },
      inputFingerprint: `preview:${sessionId}:${nowIso()}`,
      ...buildAggregationExtras(sessionId, documents, fields, costLineItems),
    });
  }

  private recalculateSessionPeriods(
    store: BillingImportStoreData,
    sessionId: string,
  ): void {
    const documents = store.documents.filter((document) => document.sessionId === sessionId);
    const fields = store.fields.filter((field) =>
      documents.some((document) => document.id === field.documentId),
    );
    const lineItems = store.costLineItems.filter((item) => item.sessionId === sessionId);
    const rebuilt = rebuildSessionPeriods({ sessionId, documents, fields, lineItems });
    // Manuell erfasste Perioden haben keine Quelldokumente und dürfen nicht verworfen werden.
    const manualPeriods = store.periods.filter(
      (period) => period.sessionId === sessionId && period.sourceDocumentIds.length === 0,
    );
    const mergedPeriods = [...rebuilt, ...manualPeriods];
    store.periods = [
      ...store.periods.filter((period) => period.sessionId !== sessionId),
      ...mergedPeriods,
    ];
    const session = store.sessions.find((entry) => entry.id === sessionId);
    if (session) {
      session.periodCount = mergedPeriods.length;
      session.updatedAt = nowIso();
      session.status = 'review_required';
    }
  }

  async confirmSessionBaseline(
    sessionId: string,
    context: BillingImportUserContext,
  ): Promise<CustomerCostBaseline | null> {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);
    if (!session || session.createdByUserId !== context.userId) {
      return null;
    }

    const documents = store.documents.filter((document) => document.sessionId === sessionId);
    const fields = store.fields.filter((field) =>
      documents.some((document) => document.id === field.documentId),
    );
    const costLineItems = store.costLineItems.filter((item) => item.sessionId === sessionId);

    this.recalculateSessionPeriods(store, sessionId);
    const periods = store.periods.filter((period) => period.sessionId === sessionId);

    for (const period of periods) {
      if (period.confirmationStatus === 'draft') {
        period.confirmationStatus = 'confirmed';
      }
    }

    detectBillingOutliers(periods);

    const baseline = aggregateCustomerCostBaseline({
      sessionId,
      leadId: session.leadId,
      offerId: session.offerId,
      documents,
      fields,
      periods,
      confirmedByUserId: context.userId,
      providerIds: [BILLING_OCR_CONFIG.providerId, 'pdf_text_extraction'],
      providerVersions: {
        ocr: BILLING_OCR_CONFIG.providerVersion,
        pdf: '1.1.0',
      },
      inputFingerprint: `billing:${sessionId}:${documents.map((d) => d.contentFingerprint).join(',')}`,
      ...buildAggregationExtras(sessionId, documents, fields, costLineItems),
    });

    if (baseline.findings.some((finding) => finding.blocking)) {
      await this.writeStore(store);
      return null;
    }

    const previous = store.baselines.filter(
      (entry) => entry.offerId === session.offerId && entry.status === 'confirmed',
    );
    for (const entry of previous) {
      entry.status = 'superseded';
      entry.updatedAt = nowIso();
    }

    store.baselines.push(baseline);
    session.status = 'confirmed';
    session.confirmedAt = nowIso();
    session.confirmedByUserId = context.userId;
    session.activeBaselineId = baseline.id;
    session.updatedAt = nowIso();

    if (session.offerId) {
      const offer = await this.offerRepository.getById(session.offerId);
      if (offer) {
        await this.offerRepository.update({
          ...offer,
          recommendationLink: {
            ...offer.recommendationLink,
            costBaselineId: baseline.id,
            costBaselineVersion: baseline.version,
          },
          updatedAt: nowIso(),
        });
      }
    }

    await this.writeStore(store);
    clearSessionFiles(sessionId);
    return baseline;
  }

  async getSessionData(sessionId: string, context: BillingImportUserContext) {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);
    if (!session || (session.createdByUserId !== context.userId && context.role !== 'admin')) {
      return null;
    }

    const documents = store.documents.filter((document) => document.sessionId === sessionId);
    const fields = store.fields.filter((field) =>
      documents.some((document) => document.id === field.documentId),
    );
    const periods = store.periods.filter((period) => period.sessionId === sessionId);
    const baseline =
      store.baselines.find((entry) => entry.id === session.activeBaselineId) ??
      store.baselines
        .filter((entry) => entry.billingImportSessionId === sessionId)
        .sort((left, right) => right.version - left.version)[0] ??
      null;

    const costLineItems = store.costLineItems.filter((item) => item.sessionId === sessionId);
    const baselinePreview = session.status !== 'confirmed'
      ? await this.computeBaselinePreview(sessionId, context)
      : null;

    return {
      session,
      documents: documents.map((document) => ({
        ...document,
        previewUrl: getSessionFilePreviewUrl(sessionId, document.id),
        rotationDegrees: getDocumentRotation(sessionId, document.id),
        extractionProgress: getDocumentProgress(sessionId, document.id),
      })),
      fields,
      periods,
      costLineItems,
      baseline,
      baselinePreview,
      findings: baselinePreview?.findings ?? baseline?.findings ?? [],
    };
  }

  async extractAllPendingDocuments(
    sessionId: string,
    context: BillingImportUserContext,
  ): Promise<BillingSourceDocument[]> {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);
    if (!session || session.createdByUserId !== context.userId) {
      return [];
    }

    const pending = store.documents.filter(
      (document) =>
        document.sessionId === sessionId &&
        document.extractionStatus === 'pending' &&
        document.duplicateStatus !== 'exact_duplicate',
    );

    const results: BillingSourceDocument[] = [];
    for (const document of pending) {
      const extracted = await this.extractDocument(sessionId, document.id, context);
      if (extracted) {
        results.push(extracted);
      }
    }
    return results;
  }

  async addManualPeriodToSession(
    sessionId: string,
    input: Parameters<typeof createManualPeriodInput>[1],
    context: BillingImportUserContext,
  ): Promise<BillingPeriodRecord | null> {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);
    if (!session || session.createdByUserId !== context.userId) {
      return null;
    }

    const period = createManualPeriodInput(sessionId, input);
    period.confirmationStatus = 'confirmed';
    store.periods = store.periods.filter(
      (entry) => !(entry.sessionId === sessionId && entry.sourceDocumentIds.length === 0 && entry.periodFrom === period.periodFrom),
    );
    store.periods.push(period);
    session.periodCount = store.periods.filter((entry) => entry.sessionId === sessionId).length;
    session.status = 'review_required';
    session.updatedAt = nowIso();
    await this.writeStore(store);
    return period;
  }

  async getSalesViewForOffer(
    offerId: string,
    context: BillingImportUserContext,
  ): Promise<SalesBillingImportView | null> {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return null;
    }

    const session =
      (await this.getActiveSessionForOffer(offerId, context)) ??
      (await this.getOrCreateSession(offerId, context));
    if (!session) {
      return null;
    }

    const data = await this.getSessionData(session.id, context);
    const baseline = await this.getActiveBaselineForOffer(offerId, context);

    return toSalesBillingImportView({
      session,
      documents: data?.documents ?? [],
      fields: data?.fields ?? [],
      periods: data?.periods ?? [],
      costLineItems: data?.costLineItems ?? [],
      baseline,
      baselinePreview: data?.baselinePreview ?? null,
      findings: data?.findings ?? [],
      recommendationHasBaselineLink: Boolean(offer.recommendationLink.costBaselineId),
    });
  }

  async getActiveBaselineForOffer(
    offerId: string,
    context: BillingImportUserContext,
  ): Promise<CustomerCostBaseline | null> {
    const store = await this.readStore();
    const baseline = store.baselines
      .filter(
        (entry) =>
          entry.offerId === offerId &&
          entry.status === 'confirmed' &&
          (context.role === 'admin' ||
            store.sessions.find((session) => session.id === entry.billingImportSessionId)
              ?.createdByUserId === context.userId),
      )
      .sort((left, right) => right.version - left.version)[0];
    return baseline ?? null;
  }

  async getActiveSessionForOffer(
    offerId: string,
    context: BillingImportUserContext,
  ): Promise<BillingImportSession | null> {
    const store = await this.readStore();
    return (
      store.sessions
        .filter(
          (session) =>
            session.offerId === offerId &&
            session.salesRepresentativeId === context.userId &&
            session.status !== 'superseded',
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
    );
  }

  async removeDocument(
    sessionId: string,
    documentId: string,
    context: BillingImportUserContext,
  ): Promise<boolean> {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);
    if (!session || session.createdByUserId !== context.userId) {
      return false;
    }

    store.documents = store.documents.filter((document) => document.id !== documentId);
    store.fields = store.fields.filter((field) => field.documentId !== documentId);
    store.periods = store.periods.filter(
      (period) => !period.sourceDocumentIds.includes(documentId),
    );
    session.fileCount = Math.max(0, session.fileCount - 1);
    session.documentCount = store.documents.filter((document) => document.sessionId === sessionId).length;
    session.updatedAt = nowIso();
    removeSessionFile(sessionId, documentId);
    await this.writeStore(store);
    return true;
  }
}

export function createManualPeriodInput(
  sessionId: string,
  input: {
    periodFrom: string;
    periodTo: string;
    currency: string;
    cardVolumeCents: number | null;
    transactionCount: number | null;
    fixedCostsCents: number | null;
    terminalCostsCents: number | null;
    transactionCostsCents: number | null;
    totalAmountCents: number | null;
  },
): BillingPeriodRecord {
  const start = new Date(`${input.periodFrom}T00:00:00.000Z`);
  const end = new Date(`${input.periodTo}T00:00:00.000Z`);
  const calendarDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const isFullMonth =
    start.getUTCDate() === 1 &&
    end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();

  return finalizePeriodMetrics({
    id: generateId('billing_period'),
    sessionId,
    sourceDocumentIds: [],
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    calendarDays,
    isFullMonth,
    isPartialPeriod: !isFullMonth,
    monthEquivalent: calendarDays / 30,
    currency: input.currency,
    netGrossBasis: 'unknown',
    cardVolumeCents: input.cardVolumeCents,
    transactionCount: input.transactionCount,
    averageTicketCents:
      input.cardVolumeCents !== null &&
      input.transactionCount !== null &&
      input.transactionCount > 0
        ? Math.round(input.cardVolumeCents / input.transactionCount)
        : null,
    fixedCostsCents: input.fixedCostsCents,
    terminalCostsCents: input.terminalCostsCents,
    transactionCostsCents: input.transactionCostsCents,
    volumeBasedCostsCents: null,
    clearingCostsCents: null,
    serviceCostsCents: null,
    otherRecurringCostsCents: null,
    oneTimeCostsCents: null,
    creditAmountCents: null,
    taxAmountCents: null,
    totalAmountCents: input.totalAmountCents,
    terminalCount: null,
    cardMix: { girocardPercent: null, creditPercent: null, debitPercent: null },
    completenessScore: 70,
    qualityStatus: 'limited',
    outlierStatus: 'none',
    outlierDecision: 'pending',
    confirmationStatus: 'confirmed',
    findings: [
      createBillingFinding({
        code: BILLING_FINDING_CODES.BILLING_CONFIRMATION_REQUIRED,
        severity: 'info',
        category: 'field',
        documentId: null,
        fieldId: null,
        blocking: false,
        internalDescription: 'Manuell erfasste Periode',
        salesDescription: 'Diese Periode wurde manuell erfasst.',
        requiredAction: null,
      }),
    ],
  });
}
