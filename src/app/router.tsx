import type { RouteObject } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { CalculatorPage } from '../features/calculator/CalculatorPage';
import { BestPayComparisonPage } from '../features/calculator/BestPayComparisonPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { EditOfferPage } from '../features/offer/EditOfferPage';
import { NewOfferPage } from '../features/offer/NewOfferPage';
import { OfferDetailPage } from '../features/offer/OfferDetailPage';
import { OffersPage } from '../features/offer/OffersPage';
import {
  OfferDocumentDetailPage,
  OfferDocumentPreviewPage,
} from '../features/offerDocument/OfferDocumentDetailPage';
import { LeadDetailPage } from '../features/lead/LeadDetailPage';
import { EditLeadPage } from '../features/lead/EditLeadPage';
import { LeadsPage } from '../features/lead/LeadsPage';
import { NewLeadPage } from '../features/lead/NewLeadPage';
import { AdminProductsPage } from '../features/product/AdminProductsPage';
import { EditProductPage } from '../features/product/EditProductPage';
import { NewProductPage } from '../features/product/NewProductPage';
import { ProductsPage } from '../features/product/ProductsPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { AdminTariffsPage } from '../features/tariff/AdminTariffsPage';
import { EditTariffPage } from '../features/tariff/EditTariffPage';
import { NewTariffPage } from '../features/tariff/NewTariffPage';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'leads/new', element: <NewLeadPage /> },
      { path: 'leads/:id/edit', element: <EditLeadPage /> },
      { path: 'leads/:id', element: <LeadDetailPage /> },
      { path: 'calculator', element: <CalculatorPage /> },
      { path: 'calculator/bestpay', element: <BestPayComparisonPage /> },
      { path: 'offers', element: <OffersPage /> },
      { path: 'offers/new', element: <NewOfferPage /> },
      { path: 'offers/:id/edit', element: <EditOfferPage /> },
      { path: 'offers/:id/preview', element: <OfferDocumentPreviewPage /> },
      { path: 'offers/:offerId/documents/:documentId', element: <OfferDocumentDetailPage /> },
      { path: 'offers/:id', element: <OfferDetailPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'admin/tariffs', element: <AdminTariffsPage /> },
      { path: 'admin/tariffs/new', element: <NewTariffPage /> },
      { path: 'admin/tariffs/:id/edit', element: <EditTariffPage /> },
      { path: 'admin/products', element: <AdminProductsPage /> },
      { path: 'admin/products/new', element: <NewProductPage /> },
      { path: 'admin/products/:id/edit', element: <EditProductPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
];
