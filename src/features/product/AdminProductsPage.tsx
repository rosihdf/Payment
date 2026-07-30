import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { SearchField } from '../../components/common/SearchField';
import {
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_CATEGORY_ORDER,
  PRODUCT_STATUS_LABELS,
  type Product,
  type ProductCategoryFilter,
  type ProductStatusFilter,
  type ProductTerminalTypeFilter,
} from '../../domain/product/product';
import { TERMINAL_TYPE_LABELS } from '../../domain/tariff/tariff';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { ProductFilters } from '../../services/productService';
import { AdminProductLayout } from './AdminProductLayout';
import { ProductCard } from './ProductCard';
import { ProductStatusBadge } from './ProductStatusBadge';
import styles from './AdminProductsPage.module.css';

const STATUS_FILTER_OPTIONS: Array<{ value: ProductStatusFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'active', label: PRODUCT_STATUS_LABELS.active },
  { value: 'inactive', label: PRODUCT_STATUS_LABELS.inactive },
];

const CATEGORY_FILTER_OPTIONS: Array<{ value: ProductCategoryFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  ...PRODUCT_CATEGORY_ORDER.map((category) => ({
    value: category as ProductCategoryFilter,
    label: PRODUCT_CATEGORY_LABELS[category],
  })),
];

const TERMINAL_FILTER_OPTIONS: Array<{ value: ProductTerminalTypeFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'stationary', label: TERMINAL_TYPE_LABELS.stationary },
  { value: 'mobile', label: TERMINAL_TYPE_LABELS.mobile },
  { value: 'softpos', label: TERMINAL_TYPE_LABELS.softpos },
  { value: 'ecommerce', label: TERMINAL_TYPE_LABELS.ecommerce },
];

export function AdminProductsPage() {
  const { currentUser } = useCurrentUser();
  const { productService } = useServices();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    status: 'all',
    category: 'all',
    terminalType: 'all',
  });
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    const result = await productService.getProducts();
    setProducts(result);
    setIsLoading(false);
  }, [productService]);

  useEffect(() => {
    setIsLoading(true);
    void loadProducts();
  }, [loadProducts]);

  const filteredProducts = productService.filterProducts(products, filters);

  const handleStatusToggle = (product: Product) => {
    if (!currentUser || statusUpdatingId) {
      return;
    }

    if (product.status === 'active') {
      setDeactivateTarget(product);
      return;
    }

    void (async () => {
      setStatusUpdatingId(product.id);
      const result = await productService.setProductStatus(product.id, 'active', {
        role: currentUser.role,
      });

      if (result.ok) {
        showToast('Produkt wurde aktiviert', 'success');
        await loadProducts();
      } else {
        showToast('Status konnte nicht geändert werden', 'error');
      }

      setStatusUpdatingId(null);
    })();
  };

  const handleDeactivateConfirmed = () => {
    if (!currentUser || !deactivateTarget) {
      return;
    }

    void (async () => {
      setStatusUpdatingId(deactivateTarget.id);
      const result = await productService.setProductStatus(deactivateTarget.id, 'inactive', {
        role: currentUser.role,
      });

      if (result.ok) {
        showToast('Produkt wurde deaktiviert', 'success');
        await loadProducts();
      } else {
        showToast('Status konnte nicht geändert werden', 'error');
      }

      setDeactivateTarget(null);
      setStatusUpdatingId(null);
    })();
  };

  return (
    <AdminProductLayout
      title="Produktverwaltung"
      subtitle="BestPay-Hardware und Produkte verwalten"
      actions={
        <Link className={styles.primaryAction} to="/admin/products/new">
          Produkt anlegen
        </Link>
      }
    >
      <div className={styles.toolbar}>
        <SearchField
          value={filters.search}
          onChange={(search) => setFilters((current) => ({ ...current, search }))}
          label="Suche"
          placeholder="Produktname, Code, Hersteller…"
        />

        <div className={styles.filters}>
          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Status</legend>
            <div className={styles.filterOptions}>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.filterButton} ${
                    filters.status === option.value ? styles.filterButtonActive : ''
                  }`}
                  aria-pressed={filters.status === option.value}
                  onClick={() => setFilters((current) => ({ ...current, status: option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Kategorie</legend>
            <div className={styles.filterOptions}>
              {CATEGORY_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.filterButton} ${
                    filters.category === option.value ? styles.filterButtonActive : ''
                  }`}
                  aria-pressed={filters.category === option.value}
                  onClick={() => setFilters((current) => ({ ...current, category: option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Einsatzart</legend>
            <div className={styles.filterOptions}>
              {TERMINAL_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.filterButton} ${
                    filters.terminalType === option.value ? styles.filterButtonActive : ''
                  }`}
                  aria-pressed={filters.terminalType === option.value}
                  onClick={() =>
                    setFilters((current) => ({ ...current, terminalType: option.value }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      {isLoading ? (
        <EmptyState title="Produkte werden geladen" description="Die Produktliste wird vorbereitet." />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="Keine Produkte gefunden"
          description="Für die aktuelle Suche oder Filterkombination liegen keine Produkte vor."
          action={
            <Link className={styles.primaryAction} to="/admin/products/new">
              Produkt anlegen
            </Link>
          }
        />
      ) : (
        <ul className={styles.list}>
          {filteredProducts.map((product) => (
            <li key={product.id}>
              <ProductCard
                product={product}
                showSource
                actions={
                  <>
                    <ProductStatusBadge status={product.status} />
                    <Link className={styles.secondaryAction} to={`/admin/products/${product.id}/edit`}>
                      Bearbeiten
                    </Link>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      disabled={statusUpdatingId === product.id}
                      onClick={() => handleStatusToggle(product)}
                    >
                      {statusUpdatingId === product.id
                        ? 'Wird aktualisiert…'
                        : product.status === 'active'
                          ? 'Deaktivieren'
                          : 'Aktivieren'}
                    </button>
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={Boolean(deactivateTarget)}
        title="Produkt deaktivieren"
        message="Das Produkt steht anschließend nicht mehr in der Außendienst-Produktübersicht zur Verfügung."
        cancelLabel="Abbrechen"
        confirmLabel="Produkt deaktivieren"
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivateConfirmed}
      />
    </AdminProductLayout>
  );
}
