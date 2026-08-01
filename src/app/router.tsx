import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AdviceEntry } from '../features/calculator/AdviceEntry';
import { CalculatorWizardRedirect } from './CalculatorWizardRedirect';
import { PreserveSearchRedirect } from './PreserveSearchRedirect';
import { SalesWorkspacePage } from '../features/sales/SalesWorkspacePage';
import { ADVICE_PATH, adminCatalogPath } from '../utils/routes';
import { EditOfferPage } from '../features/offer/EditOfferPage';
import { NewOfferPage } from '../features/offer/NewOfferPage';
import { OfferDetailPage } from '../features/offer/OfferDetailPage';
import { OffersPage } from '../features/offer/OffersPage';
import { ContractDetailPage } from '../features/contract/ContractDetailPage';
import { ContractsPage } from '../features/contract/ContractsPage';
import { ActivationDetailPage } from '../features/activation/ActivationDetailPage';
import { ActivationsPage } from '../features/activation/ActivationsPage';
import {
  OfferDocumentDetailPage,
  OfferDocumentPreviewPage,
} from '../features/offerDocument/OfferDocumentDetailPage';
import { LeadDetailPage } from '../features/lead/LeadDetailPage';
import { EditLeadPage } from '../features/lead/EditLeadPage';
import { LeadsPage } from '../features/lead/LeadsPage';
import { NewLeadPage } from '../features/lead/NewLeadPage';
import { AdminOverviewPage } from '../features/admin/AdminOverviewPage';
import { AdminUsersPage, AdminRolesPage } from '../features/admin/AdminUsersPage';
import { AdminCatalogPage } from '../features/admin/AdminCatalogPage';
import {
  AdminPricingPage,
  AdminProductsPage,
  AdminProductsManageRedirect,
  AdminTariffsListRedirect,
} from '../features/admin/AdminCatalogPages';
import { AdminCommissionPage } from '../features/admin/AdminCommissionPage';
import {
  AdminCommissionOverviewPage,
} from '../features/admin/commission/AdminCommissionOverviewPage';
import { AdminCommissionAssignmentsPage } from '../features/admin/commission/AdminCommissionAssignmentsPage';
import { AdminCommissionCasesPage } from '../features/admin/commission/AdminCommissionCasesPage';
import { AdminCommissionBonusPage } from '../features/admin/commission/AdminCommissionBonusPage';
import { AdminCommissionPaymentsPage } from '../features/admin/commission/AdminCommissionPaymentsPage';
import { AdminCommissionModelsPage } from '../features/admin/commission/AdminCommissionModelsPage';
import { AdminCommissionHistoryPage } from '../features/admin/commission/AdminCommissionHistoryPage';
import { SalesCommissionPage } from '../features/sales/SalesCommissionPage';
import { AdminApprovalsPage } from '../features/admin/AdminApprovalsPage';
import { AdminTemplatesPage } from '../features/admin/AdminTemplatesPage';
import { AdminDataPage } from '../features/admin/AdminDataPage';
import { AdminAuditPage } from '../features/admin/AdminAuditPage';
import { AdminSystemPage } from '../features/admin/AdminSystemPage';
import { EditProductPage } from '../features/product/EditProductPage';
import { NewProductPage } from '../features/product/NewProductPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { EditTariffPage } from '../features/tariff/EditTariffPage';
import { NewTariffPage } from '../features/tariff/NewTariffPage';
import { LoginPage } from '../features/auth/LoginPage';
import { AuthCallbackPage } from '../features/auth/AuthCallbackPage';
import { RequireAuth } from '../features/auth/RequireAuth';

export const appRoutes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/set-password', element: <AuthCallbackPage /> },
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
      { path: 'leads/:id', element: <LeadDetailPage /> },
      { path: 'sales', element: <SalesWorkspacePage /> },
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
      { path: 'admin/commission/overview', element: <AdminCommissionOverviewPage /> },
      { path: 'admin/commission/assignments', element: <AdminCommissionAssignmentsPage /> },
      { path: 'admin/commission/cases', element: <AdminCommissionCasesPage /> },
      { path: 'admin/commission/bonus', element: <AdminCommissionBonusPage /> },
      { path: 'admin/commission/payments', element: <AdminCommissionPaymentsPage /> },
      { path: 'admin/commission/models', element: <AdminCommissionModelsPage /> },
      { path: 'admin/commission/history', element: <AdminCommissionHistoryPage /> },
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
