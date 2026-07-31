import type { ApprovalRule } from '../domain/approvalRule/approvalRule';
import type { User, UserContext } from '../domain/user/user';
import type { Tariff } from '../domain/tariff/tariff';
import type { Product } from '../domain/product/product';
import { hasPermission } from '../domain/permission/permission';
import { readStorageItem, STORAGE_KEYS } from '../utils/storage';
import type { ApprovalRuleService } from './approvalRuleService';
import type { DataDiagnosticService } from './dataDiagnosticService';
import type { DataExportService } from './dataExportService';
import type { AdminUserService } from './adminUserService';
import type { TariffRepository } from '../repositories/interfaces/TariffRepository';
import type { ProductRepository } from '../repositories/interfaces/ProductRepository';
import type { CommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';

export interface AdminOverviewMetrics {
  activeUsers: number;
  deactivatedUsers: number;
  activeTariffs: number;
  expiringTariffs: number;
  incompleteProducts: number;
  hardwareWithoutPrice: number;
  invalidCommissionPlans: number;
  approvalRuleConflicts: number;
  diagnosticIssues: number;
  pendingMigrations: number;
  lastBackupAt: string | null;
  lastExportAt: string | null;
  administrativeHints: string[];
}

export class AdminOverviewService {
  private readonly adminUserService: AdminUserService;
  private readonly tariffRepository: TariffRepository;
  private readonly productRepository: ProductRepository;
  private readonly commissionCatalogRepository: CommissionCatalogRepository;
  private readonly approvalRuleService: ApprovalRuleService;
  private readonly dataDiagnosticService: DataDiagnosticService;
  private readonly dataExportService: DataExportService;

  constructor(
    adminUserService: AdminUserService,
    tariffRepository: TariffRepository,
    productRepository: ProductRepository,
    commissionCatalogRepository: CommissionCatalogRepository,
    approvalRuleService: ApprovalRuleService,
    dataDiagnosticService: DataDiagnosticService,
    dataExportService: DataExportService,
  ) {
    this.adminUserService = adminUserService;
    this.tariffRepository = tariffRepository;
    this.productRepository = productRepository;
    this.commissionCatalogRepository = commissionCatalogRepository;
    this.approvalRuleService = approvalRuleService;
    this.dataDiagnosticService = dataDiagnosticService;
    this.dataExportService = dataExportService;
  }

  canAccessAdmin(context: UserContext): boolean {
    return hasPermission(context.role, 'admin.access') && context.status === 'active';
  }

  countIncompleteProduct(product: Product): boolean {
    return !product.name?.trim() || !product.internalProductCode?.trim();
  }

  isHardwareWithoutPrice(product: Product): boolean {
    return product.category === 'payment_terminal' && product.priceType === 'on_request';
  }

  async getOverview(context: UserContext): Promise<AdminOverviewMetrics | { error: 'forbidden' }> {
    if (!this.canAccessAdmin(context)) {
      return { error: 'forbidden' };
    }

    const usersResult = await this.adminUserService.getUsers(context);
    const users = Array.isArray(usersResult) ? usersResult : [];
    const tariffs = await this.tariffRepository.getAll();
    const products = await this.productRepository.getAll();
    const commissionCatalog = await this.commissionCatalogRepository.getCatalog();
    const rulesResult = await this.approvalRuleService.getRules(context);
    const rules = Array.isArray(rulesResult) ? rulesResult : [];
    const diagnostics = await this.dataDiagnosticService.runDiagnostics(context);
    const diagnosticIssues = Array.isArray(diagnostics) ? diagnostics.length : 0;

    const activeUsers = users.filter((user: User) => user.status === 'active').length;
    const deactivatedUsers = users.filter((user: User) => user.status === 'deactivated').length;
    const activeTariffs = tariffs.filter((tariff: Tariff) => tariff.status === 'active').length;
    const expiringTariffs = tariffs.filter(
      (tariff: Tariff) => tariff.validUntil && tariff.validUntil <= '2026-12-31',
    ).length;
    const incompleteProducts = products.filter((product) => this.countIncompleteProduct(product)).length;
    const hardwareWithoutPrice = products.filter((product) => this.isHardwareWithoutPrice(product)).length;
    const invalidCommissionPlans =
      commissionCatalog.commissionPlans.filter((plan) => plan.status === 'active').length === 0 ? 1 : 0;
    const approvalRuleConflicts = this.approvalRuleService.detectConflicts(rules as ApprovalRule[]).length;

    const hints: string[] = [];
    if (invalidCommissionPlans > 0) {
      hints.push('Kein aktives Provisionsmodell konfiguriert.');
    }
    if (approvalRuleConflicts > 0) {
      hints.push('Freigaberegeln mit Konflikten prüfen.');
    }
    if (diagnosticIssues > 0) {
      hints.push(`${diagnosticIssues} Diagnosehinweise offen.`);
    }
    hints.push('Daten liegen lokal im Browser – regelmäßige Sicherung empfohlen.');

    const backupHistory = this.dataExportService.getBackupHistory();
    const exportHistory = this.dataExportService.getExportHistory();

    const pendingMigrations = [
      readStorageItem<number>(STORAGE_KEYS.adminStorageVersion) ?? 0,
      readStorageItem<number>(STORAGE_KEYS.userStorageVersion) ?? 0,
    ].filter((version) => version < 1).length;

    return {
      activeUsers,
      deactivatedUsers,
      activeTariffs,
      expiringTariffs,
      incompleteProducts,
      hardwareWithoutPrice,
      invalidCommissionPlans,
      approvalRuleConflicts,
      diagnosticIssues,
      pendingMigrations,
      lastBackupAt: backupHistory[0]?.createdAt ?? null,
      lastExportAt: exportHistory[0]?.createdAt ?? null,
      administrativeHints: hints,
    };
  }
}
