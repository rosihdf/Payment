import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { AppShell } from '../v2/layout/AppShell';
import { AdviceEntry } from '../v2/advice/AdviceEntry';
import { LeadsPage } from '../v2/crm/LeadsPage';
import { LeadRecordPage } from '../v2/crm/LeadRecordPage';
import { WorkspacePage } from '../v2/workspace/WorkspacePage';
import { CalculatorWizardRedirect } from './CalculatorWizardRedirect';
import { PreserveSearchRedirect } from './PreserveSearchRedirect';
import { ADVICE_PATH, adminCatalogPath } from '../utils/routes';
import { EditOfferPage } from '../v2/offer/EditOfferPage';
import { NewOfferPage } from '../v2/offer/NewOfferPage';
import { OfferDetailPage } from '../v2/offer/OfferDetailPage';
import { OffersPage } from '../v2/offer/OffersPage';
import { ContractDetailPage } from '../v2/contract/ContractDetailPage';
import { ContractsPage } from '../v2/contract/ContractsPage';
import { ActivationDetailPage } from '../v2/activation/ActivationDetailPage';
import { ActivationsPage } from '../v2/activation/ActivationsPage';
import {
  OfferDocumentDetailPage,
  OfferDocumentPreviewPage,
} from '../v2/offer/OfferDocumentPages';
import { EditLeadPage } from '../v2/crm/EditLeadPage';
import { NewLeadPage } from '../v2/crm/NewLeadPage';
import { AdminOverviewPage } from '../v2/admin/AdminOverviewPage';
import { AdminUsersPage, AdminRolesPage } from '../v2/admin/AdminUsersPage';
import { AdminCatalogPage } from '../v2/admin/AdminCatalogPage';
import {
  AdminPricingPage,
  AdminProductsPage,
  AdminProductsManageRedirect,
  AdminTariffsListRedirect,
} from '../features/admin/AdminCatalogPages';
import {
  CommissionOverviewPage,
  CommissionStandardsPage,
  CommissionCasesPage,
  CommissionBonusPage,
  CommissionSettlementPage,
  SalesCommissionPage,
} from '../v2/commission';
import { AdminCommissionPage } from '../features/admin/AdminCommissionPage';
import { AdminApprovalsPage } from '../v2/admin/AdminApprovalsPage';
import { AdminTemplatesPage } from '../v2/admin/AdminTemplatesPage';
import { AdminDataPage } from '../v2/admin/AdminDataPage';
import { AdminAuditPage } from '../v2/admin/AdminAuditPage';
import { AdminSystemPage } from '../v2/admin/AdminSystemPage';
import { EditProductPage } from '../features/product/EditProductPage';
import { NewProductPage } from '../features/product/NewProductPage';
import { ProfilePage } from '../v2/profile/ProfilePage';
import { EditTariffPage } from '../features/tariff/EditTariffPage';
import { NewTariffPage } from '../features/tariff/NewTariffPage';
import { LoginPage } from '../features/auth/LoginPage';
import { AuthCallbackPage } from '../features/auth/AuthCallbackPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { OfferReviewPage } from '../features/offer/OfferReviewPage';

export const appRoutes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/set-password', element: <AuthCallbackPage /> },
  { path: '/offer-review/:token', element: <OfferReviewPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/sales" replace /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'leads/new', element: <NewLeadPage /> },
      { path: 'leads/:id/edit', element: <EditLeadPage /> },
      { path: 'leads/:id', element: <LeadRecordPage /> },
      { path: 'sales', element: <WorkspacePage /> },
      { path: 'sales/commission', element: <SalesCommissionPage /> },
      { path: 'advice', element: <AdviceEntry /> },
      { path: 'advice/quick', element: <Navigate to={ADVICE_PATH} replace /> },
      {
        path: 'sales/wizard',
        element: <PreserveSearchRedirect to={ADVICE_PATH} />,
      },
      {
        path: 'calculator',
        element: <PreserveSearchRedirect to={ADVICE_PATH} />,
      },
      { path: 'calculator/wizard', element: <CalculatorWizardRedirect /> },
      { path: 'calculator/bestpay/history', element: <Navigate to={ADVICE_PATH} replace /> },
      { path: 'calculator/bestpay', element: <PreserveSearchRedirect to={ADVICE_PATH} /> },
      { path: 'offers', element: <OffersPage /> },
      { path: 'offers/new', element: <NewOfferPage /> },
      { path: 'offers/:id/edit', element: <EditOfferPage /> },
      { path: 'offers/:id/preview', element: <OfferDocumentPreviewPage /> },
      { path: 'offers/:offerId/documents/:documentId', element: <OfferDocumentDetailPage /> },
      { path: 'offers/:id', element: <OfferDetailPage /> },
      { path: 'contracts', element: <ContractsPage /> },
      { path: 'contracts/:contractId', element: <ContractDetailPage /> },
      { path: 'activations', element: <ActivationsPage /> },
      { path: 'activations/:activationId', element: <ActivationDetailPage /> },
      { path: 'products', element: <Navigate to={adminCatalogPath('products')} replace /> },
      { path: 'admin', element: <AdminOverviewPage /> },
      { path: 'admin/users', element: <AdminUsersPage /> },
      { path: 'admin/roles', element: <AdminRolesPage /> },
      { path: 'admin/catalog', element: <AdminCatalogPage /> },
      { path: 'admin/pricing', element: <AdminPricingPage /> },
      { path: 'admin/products', element: <AdminProductsPage /> },
      { path: 'admin/products/manage', element: <AdminProductsManageRedirect /> },
      { path: 'admin/products/manage/new', element: <NewProductPage /> },
      { path: 'admin/products/manage/:id/edit', element: <EditProductPage /> },
      { path: 'admin/commission', element: <AdminCommissionPage /> },
      { path: 'admin/commission/overview', element: <CommissionOverviewPage /> },
      { path: 'admin/commission/standards', element: <CommissionStandardsPage /> },
      { path: 'admin/commission/cases', element: <CommissionCasesPage /> },
      { path: 'admin/commission/bonus', element: <CommissionBonusPage /> },
      { path: 'admin/commission/settlement', element: <CommissionSettlementPage /> },
      { path: 'admin/commission/models', element: <Navigate to="/admin/commission/standards" replace /> },
      { path: 'admin/commission/assignments', element: <Navigate to="/admin/commission/standards" replace /> },
      { path: 'admin/commission/payments', element: <Navigate to="/admin/commission/settlement" replace /> },
      { path: 'admin/commission/history', element: <Navigate to="/admin/commission/settlement" replace /> },
      { path: 'admin/approvals', element: <AdminApprovalsPage /> },
      { path: 'admin/templates', element: <AdminTemplatesPage /> },
      { path: 'admin/data', element: <AdminDataPage /> },
      { path: 'admin/audit', element: <AdminAuditPage /> },
      { path: 'admin/system', element: <AdminSystemPage /> },
      { path: 'admin/tariffs', element: <AdminTariffsListRedirect /> },
      { path: 'admin/tariffs/new', element: <NewTariffPage /> },
      { path: 'admin/tariffs/:id/edit', element: <EditTariffPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
];
