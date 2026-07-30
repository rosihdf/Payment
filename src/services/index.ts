import type { LeadDraftRepository } from '../repositories/interfaces/LeadDraftRepository';
import type { LeadEditDraftRepository } from '../repositories/interfaces/LeadEditDraftRepository';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import type { OfferDocumentRepository } from '../repositories/interfaces/OfferDocumentRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { PricingCatalogRepository } from '../repositories/interfaces/PricingCatalogRepository';
import type { PricingEvaluationRepository } from '../repositories/interfaces/PricingEvaluationRepository';
import type { ProductRepository } from '../repositories/interfaces/ProductRepository';
import type { TariffRepository } from '../repositories/interfaces/TariffRepository';
import type { UserRepository } from '../repositories/interfaces/UserRepository';
import { LocalCommissionCalculationRepository } from '../repositories/local/LocalCommissionCalculationRepository';
import { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { LocalRecommendationRepository } from '../repositories/local/LocalRecommendationRepository';
import { CommissionCalculationService } from './commissionCalculationService';
import { RecommendationService } from './recommendationService';
import { BillingImportService } from './billingImportService';
import { BestPayComparisonService } from './bestPayComparisonService';
import { LeadDraftService } from './leadDraftService';
import { LeadEditDraftService } from './leadEditDraftService';
import { LeadService } from './leadService';
import { createOfferDocumentService } from './offerDocumentService';
import { OfferService } from './offerService';
import { PricingEvaluationService } from './pricingEvaluationService';
import { ProductService } from './productService';
import { TariffService } from './tariffService';
import { UserService } from './userService';

export interface AppServices {
  userService: UserService;
  leadService: LeadService;
  leadDraftService: LeadDraftService;
  leadEditDraftService: LeadEditDraftService;
  tariffService: TariffService;
  productService: ProductService;
  offerService: OfferService;
  offerDocumentService: ReturnType<typeof createOfferDocumentService>;
  pricingEvaluationService: PricingEvaluationService;
  commissionCalculationService: CommissionCalculationService;
  recommendationService: RecommendationService;
  billingImportService: BillingImportService;
  bestPayComparisonService: BestPayComparisonService;
}

export interface AppRepositories {
  userRepository: UserRepository;
  leadRepository: LeadRepository;
  leadDraftRepository: LeadDraftRepository;
  leadEditDraftRepository: LeadEditDraftRepository;
  tariffRepository: TariffRepository;
  productRepository: ProductRepository;
  offerRepository: OfferRepository;
  offerDocumentRepository: OfferDocumentRepository;
  pricingCatalogRepository: PricingCatalogRepository;
  pricingEvaluationRepository: PricingEvaluationRepository;
  commissionCatalogRepository: LocalCommissionCatalogRepository;
  commissionCalculationRepository: LocalCommissionCalculationRepository;
  recommendationRepository: LocalRecommendationRepository;
}

export function createServices(repositories: AppRepositories): AppServices {
  const offerService = new OfferService(
    repositories.offerRepository,
    repositories.leadRepository,
    repositories.tariffRepository,
    repositories.productRepository,
  );
  const billingImportService = new BillingImportService(repositories.offerRepository);
  const recommendationService = new RecommendationService(
    repositories.recommendationRepository,
    repositories.offerRepository,
    repositories.leadRepository,
    repositories.tariffRepository,
    repositories.productRepository,
    repositories.pricingCatalogRepository,
    repositories.commissionCatalogRepository,
    billingImportService,
  );
  const bestPayComparisonService = new BestPayComparisonService(
    billingImportService,
    recommendationService,
    offerService,
    repositories.leadRepository,
    repositories.offerRepository,
  );

  return {
    userService: new UserService(repositories.userRepository),
    leadService: new LeadService(repositories.leadRepository),
    leadDraftService: new LeadDraftService(repositories.leadDraftRepository),
    leadEditDraftService: new LeadEditDraftService(repositories.leadEditDraftRepository),
    tariffService: new TariffService(repositories.tariffRepository),
    productService: new ProductService(repositories.productRepository),
    offerService,
    offerDocumentService: createOfferDocumentService(
      repositories.offerDocumentRepository,
      repositories.offerRepository,
      offerService,
    ),
    pricingEvaluationService: new PricingEvaluationService(
      repositories.pricingCatalogRepository,
      repositories.pricingEvaluationRepository,
      repositories.offerRepository,
    ),
    commissionCalculationService: new CommissionCalculationService(
      repositories.commissionCatalogRepository,
      repositories.commissionCalculationRepository,
      repositories.offerRepository,
      repositories.pricingEvaluationRepository,
    ),
    billingImportService,
    recommendationService,
    bestPayComparisonService,
  };
}
