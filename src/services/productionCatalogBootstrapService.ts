import type { UserContext } from '../domain/user/user';
import type { ApprovalRuleRepository } from '../repositories/interfaces/ApprovalRuleRepository';
import type { CommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import type { DocumentTemplateRepository } from '../repositories/interfaces/DocumentTemplateRepository';
import type { PricingCatalogRepository } from '../repositories/interfaces/PricingCatalogRepository';
import type { ProductRepository } from '../repositories/interfaces/ProductRepository';
import type { RecommendationRepository } from '../repositories/interfaces/RecommendationRepository';
import type { TariffRepository } from '../repositories/interfaces/TariffRepository';
import {
  createProductionBaselineCatalog,
  createProductionCommissionAssignment,
} from '../domain/catalog/productionBaselineCatalog';
import type { AuditService } from './auditService';
import { requirePermission } from './auditService';

export interface ProductionCatalogBootstrapAreaPreview {
  areaKey: string;
  label: string;
  existingCount: number;
  toInsertCount: number;
  skippedCount: number;
}

export interface ProductionCatalogBootstrapPreview {
  version: number;
  areas: ProductionCatalogBootstrapAreaPreview[];
  totalToInsert: number;
}

export interface ProductionCatalogBootstrapResult {
  ok: true;
  preview: ProductionCatalogBootstrapPreview;
  insertedCounts: Record<string, number>;
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): {
  merged: T[];
  inserted: number;
} {
  const existingIds = new Set(existing.map((item) => item.id));
  const toAdd = incoming.filter((item) => !existingIds.has(item.id));
  return {
    merged: [...existing, ...toAdd],
    inserted: toAdd.length,
  };
}

export class ProductionCatalogBootstrapService {
  private readonly tariffRepository: TariffRepository;
  private readonly productRepository: ProductRepository;
  private readonly commissionCatalogRepository: CommissionCatalogRepository;
  private readonly pricingCatalogRepository: PricingCatalogRepository;
  private readonly recommendationRepository: RecommendationRepository;
  private readonly approvalRuleRepository: ApprovalRuleRepository;
  private readonly documentTemplateRepository: DocumentTemplateRepository;
  private readonly auditService: AuditService;

  constructor(
    tariffRepository: TariffRepository,
    productRepository: ProductRepository,
    commissionCatalogRepository: CommissionCatalogRepository,
    pricingCatalogRepository: PricingCatalogRepository,
    recommendationRepository: RecommendationRepository,
    approvalRuleRepository: ApprovalRuleRepository,
    documentTemplateRepository: DocumentTemplateRepository,
    auditService: AuditService,
  ) {
    this.tariffRepository = tariffRepository;
    this.productRepository = productRepository;
    this.commissionCatalogRepository = commissionCatalogRepository;
    this.pricingCatalogRepository = pricingCatalogRepository;
    this.recommendationRepository = recommendationRepository;
    this.approvalRuleRepository = approvalRuleRepository;
    this.documentTemplateRepository = documentTemplateRepository;
    this.auditService = auditService;
  }

  async preview(context: UserContext): Promise<
    { ok: true; preview: ProductionCatalogBootstrapPreview } | { ok: false; error: 'forbidden' }
  > {
    const guard = requirePermission(context, 'admin.backup');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const preview = await this.buildPreview(context.userId);
    return { ok: true, preview };
  }

  async execute(context: UserContext): Promise<
    ProductionCatalogBootstrapResult | { ok: false; error: 'forbidden' }
  > {
    const guard = requirePermission(context, 'admin.backup');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const baseline = createProductionBaselineCatalog(context.userId);
    const preview = await this.buildPreview(context.userId);
    const insertedCounts: Record<string, number> = {};

    for (const tariff of baseline.tariffs) {
      if (!(await this.tariffRepository.getById(tariff.id))) {
        await this.tariffRepository.create(tariff);
        insertedCounts.tariffs = (insertedCounts.tariffs ?? 0) + 1;
      }
    }

    for (const product of baseline.products) {
      if (!(await this.productRepository.getById(product.id))) {
        await this.productRepository.create(product);
        insertedCounts.products = (insertedCounts.products ?? 0) + 1;
      }
    }

    const commissionCatalog = await this.commissionCatalogRepository.getCatalog();
    const mergedPlans = mergeById(commissionCatalog.commissionPlans, baseline.commissionPlans);
    const mergedVersions = mergeById(
      commissionCatalog.commissionPlanVersions,
      baseline.commissionPlanVersions,
    );
    const mergedRules = mergeById(commissionCatalog.commissionRules, baseline.commissionRules);
    let mergedAssignments = [...commissionCatalog.assignments];
    if (mergedAssignments.length === 0 && mergedVersions.merged.length > 0) {
      mergedAssignments = [
        createProductionCommissionAssignment(
          context.userId,
          mergedVersions.merged[0]!.id,
        ),
      ];
      insertedCounts.commissionAssignments = 1;
    }
    if (
      mergedPlans.inserted > 0 ||
      mergedVersions.inserted > 0 ||
      mergedRules.inserted > 0 ||
      (insertedCounts.commissionAssignments ?? 0) > 0
    ) {
      await this.commissionCatalogRepository.saveCatalog({
        commissionPlans: mergedPlans.merged,
        commissionPlanVersions: mergedVersions.merged,
        commissionRules: mergedRules.merged,
        assignments: mergedAssignments,
      });
      insertedCounts.commissionPlans = mergedPlans.inserted;
      insertedCounts.commissionPlanVersions = mergedVersions.inserted;
      insertedCounts.commissionRules = mergedRules.inserted;
    }

    const pricingCatalog = await this.pricingCatalogRepository.getCatalog();
    const mergedPriceBooks = mergeById(pricingCatalog.priceBooks, baseline.priceBooks);
    const mergedPriceBookVersions = mergeById(
      pricingCatalog.priceBookVersions,
      baseline.priceBookVersions,
    );
    const mergedContractTerms = mergeById(pricingCatalog.contractTerms, baseline.contractTerms);
    const mergedPriceRules = mergeById(pricingCatalog.priceRules, baseline.priceRules);
    if (
      mergedPriceBooks.inserted > 0 ||
      mergedPriceBookVersions.inserted > 0 ||
      mergedContractTerms.inserted > 0 ||
      mergedPriceRules.inserted > 0
    ) {
      await this.pricingCatalogRepository.saveCatalog({
        priceBooks: mergedPriceBooks.merged,
        priceBookVersions: mergedPriceBookVersions.merged,
        contractTerms: mergedContractTerms.merged,
        priceRules: mergedPriceRules.merged,
      });
      insertedCounts.priceBooks = mergedPriceBooks.inserted;
      insertedCounts.priceBookVersions = mergedPriceBookVersions.inserted;
      insertedCounts.contractTerms = mergedContractTerms.inserted;
      insertedCounts.priceRules = mergedPriceRules.inserted;
    }

    const existingWeightSets = await this.recommendationRepository.getWeightSets();
    const mergedWeightSets = mergeById(existingWeightSets, baseline.recommendationWeightSets);
    if (mergedWeightSets.inserted > 0) {
      await this.recommendationRepository.saveWeightSets(mergedWeightSets.merged);
      insertedCounts.recommendationWeightSets = mergedWeightSets.inserted;
    }

    const existingApprovalRules = await this.approvalRuleRepository.getAll();
    const mergedApprovalRules = mergeById(existingApprovalRules, baseline.approvalRules);
    if (mergedApprovalRules.inserted > 0) {
      await this.approvalRuleRepository.saveAll(mergedApprovalRules.merged);
      insertedCounts.approvalRules = mergedApprovalRules.inserted;
    }

    const existingTemplates = await this.documentTemplateRepository.getAll();
    const mergedTemplates = mergeById(existingTemplates, baseline.documentTemplates);
    if (mergedTemplates.inserted > 0) {
      for (const template of baseline.documentTemplates) {
        if (!existingTemplates.some((item) => item.id === template.id)) {
          await this.documentTemplateRepository.save(template);
        }
      }
      insertedCounts.documentTemplates = mergedTemplates.inserted;
    }

    await this.auditService.logChange({
      context,
      action: 'migration',
      entityType: 'system',
      entityId: 'production_baseline',
      summary: `Grundkonfiguration importiert (${preview.totalToInsert} geplante Datensätze)`,
    });

    return { ok: true, preview, insertedCounts };
  }

  private async buildPreview(userId: string): Promise<ProductionCatalogBootstrapPreview> {
    const baseline = createProductionBaselineCatalog(userId);
    const [
      tariffs,
      products,
      commissionCatalog,
      pricingCatalog,
      weightSets,
      approvalRules,
      documentTemplates,
    ] = await Promise.all([
      this.tariffRepository.getAll(),
      this.productRepository.getAll(),
      this.commissionCatalogRepository.getCatalog(),
      this.pricingCatalogRepository.getCatalog(),
      this.recommendationRepository.getWeightSets(),
      this.approvalRuleRepository.getAll(),
      this.documentTemplateRepository.getAll(),
    ]);

    const tariffIds = new Set(tariffs.map((item) => item.id));
    const productIds = new Set(products.map((item) => item.id));
    const planIds = new Set(commissionCatalog.commissionPlans.map((item) => item.id));
    const versionIds = new Set(commissionCatalog.commissionPlanVersions.map((item) => item.id));
    const ruleIds = new Set(commissionCatalog.commissionRules.map((item) => item.id));
    const priceBookIds = new Set(pricingCatalog.priceBooks.map((item) => item.id));
    const priceBookVersionIds = new Set(pricingCatalog.priceBookVersions.map((item) => item.id));
    const contractTermIds = new Set(pricingCatalog.contractTerms.map((item) => item.id));
    const priceRuleIds = new Set(pricingCatalog.priceRules.map((item) => item.id));
    const weightSetIds = new Set(weightSets.map((item) => item.id));
    const approvalRuleIds = new Set(approvalRules.map((item) => item.id));
    const templateIds = new Set(documentTemplates.map((item) => item.id));

    const areas: ProductionCatalogBootstrapAreaPreview[] = [
      area('tariffs', 'Tarife', tariffs.length, baseline.tariffs.filter((item) => !tariffIds.has(item.id)).length),
      area('products', 'Produkte', products.length, baseline.products.filter((item) => !productIds.has(item.id)).length),
      area(
        'commissionPlans',
        'Provisionspläne',
        commissionCatalog.commissionPlans.length,
        baseline.commissionPlans.filter((item) => !planIds.has(item.id)).length,
      ),
      area(
        'commissionPlanVersions',
        'Provisionsplan-Versionen',
        commissionCatalog.commissionPlanVersions.length,
        baseline.commissionPlanVersions.filter((item) => !versionIds.has(item.id)).length,
      ),
      area(
        'commissionRules',
        'Provisionsregeln',
        commissionCatalog.commissionRules.length,
        baseline.commissionRules.filter((item) => !ruleIds.has(item.id)).length,
      ),
      area(
        'commissionAssignments',
        'Provisionszuordnungen',
        commissionCatalog.assignments.length,
        commissionCatalog.assignments.length === 0 ? 1 : 0,
      ),
      area(
        'priceBooks',
        'Preislisten',
        pricingCatalog.priceBooks.length,
        baseline.priceBooks.filter((item) => !priceBookIds.has(item.id)).length,
      ),
      area(
        'priceBookVersions',
        'Preislisten-Versionen',
        pricingCatalog.priceBookVersions.length,
        baseline.priceBookVersions.filter((item) => !priceBookVersionIds.has(item.id)).length,
      ),
      area(
        'contractTerms',
        'Vertragslaufzeiten',
        pricingCatalog.contractTerms.length,
        baseline.contractTerms.filter((item) => !contractTermIds.has(item.id)).length,
      ),
      area(
        'priceRules',
        'Preisregeln',
        pricingCatalog.priceRules.length,
        baseline.priceRules.filter((item) => !priceRuleIds.has(item.id)).length,
      ),
      area(
        'recommendationWeightSets',
        'Empfehlungs-Gewichtung',
        weightSets.length,
        baseline.recommendationWeightSets.filter((item) => !weightSetIds.has(item.id)).length,
      ),
      area(
        'approvalRules',
        'Freigaberegeln',
        approvalRules.length,
        baseline.approvalRules.filter((item) => !approvalRuleIds.has(item.id)).length,
      ),
      area(
        'documentTemplates',
        'Dokumentvorlagen',
        documentTemplates.length,
        baseline.documentTemplates.filter((item) => !templateIds.has(item.id)).length,
      ),
    ];

    const totalToInsert = areas.reduce((sum, entry) => sum + entry.toInsertCount, 0);

    return {
      version: baseline.version,
      areas,
      totalToInsert,
    };
  }
}

function area(
  areaKey: string,
  label: string,
  existingCount: number,
  toInsertCount: number,
): ProductionCatalogBootstrapAreaPreview {
  return {
    areaKey,
    label,
    existingCount,
    toInsertCount,
    skippedCount: existingCount,
  };
}
