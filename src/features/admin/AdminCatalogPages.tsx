import { AdminCatalogRedirect } from './AdminCatalogRedirect';

/** Legacy: /admin/pricing → Katalog Preisregeln */
export function AdminPricingPage() {
  return <AdminCatalogRedirect tab="rules" />;
}

/** Legacy: /admin/products → Katalog Produkte */
export function AdminProductsPage() {
  return <AdminCatalogRedirect tab="products" />;
}

/** Legacy: /admin/tariffs → Katalog Tarife */
export function AdminTariffsListRedirect() {
  return <AdminCatalogRedirect tab="tariffs" />;
}

/** Legacy: /admin/products/manage → Katalog Produkte */
export function AdminProductsManageRedirect() {
  return <AdminCatalogRedirect tab="products" />;
}
