import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
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
import { AdminLayout } from '../admin/AdminLayout';
import { Button } from '../../v2/ui/Button';
import { DataList } from '../../v2/ui/DataList';
import { Dialog } from '../../v2/ui/Dialog';
import { FormField } from '../../v2/ui/FormField';
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

interface AdminProductsPageProps {
  /** In den zentralen Katalog eingebettet (ohne eigene Seitenhülle). */
  embedded?: boolean;
}

export function AdminProductsPage({ embedded = false }: AdminProductsPageProps) {
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

  const createAction = (
    <Link to="/admin/products/manage/new">
      <Button>Produkt anlegen</Button>
    </Link>
  );

  const content = (
    <>
      {embedded ? <div className={styles.embeddedActions}>{createAction}</div> : null}
      <div className={styles.toolbar}>
        <FormField
          type="search"
          label="Suche"
          value={filters.search}
          onChange={(event) =>
            setFilters((current) => ({ ...current, search: event.target.value }))
          }
          placeholder="Produktname, Code, Hersteller…"
        />

        <div className={styles.filters}>
          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Status</legend>
            <div className={styles.filterOptions}>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="compact"
                  variant={filters.status === option.value ? 'primary' : 'secondary'}
                  aria-pressed={filters.status === option.value}
                  onClick={() => setFilters((current) => ({ ...current, status: option.value }))}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Kategorie</legend>
            <div className={styles.filterOptions}>
              {CATEGORY_FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="compact"
                  variant={filters.category === option.value ? 'primary' : 'secondary'}
                  aria-pressed={filters.category === option.value}
                  onClick={() => setFilters((current) => ({ ...current, category: option.value }))}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Einsatzart</legend>
            <div className={styles.filterOptions}>
              {TERMINAL_FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="compact"
                  variant={filters.terminalType === option.value ? 'primary' : 'secondary'}
                  aria-pressed={filters.terminalType === option.value}
                  onClick={() =>
                    setFilters((current) => ({ ...current, terminalType: option.value }))
                  }
                >
                  {option.label}
                </Button>
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
          action={createAction}
        />
      ) : (
        <DataList
          items={filteredProducts}
          getKey={(product) => product.id}
          aria-label="Produktliste"
          className={styles.list}
          renderItem={(product) => (
            <ProductCard
              product={product}
              showSource
              actions={
                <>
                  <ProductStatusBadge status={product.status} />
                  <Link to={`/admin/products/manage/${product.id}/edit`}>
                    <Button variant="secondary" size="compact">Bearbeiten</Button>
                  </Link>
                  <Button
                    type="button"
                    size="compact"
                    variant="secondary"
                    disabled={statusUpdatingId === product.id}
                    loading={statusUpdatingId === product.id}
                    onClick={() => handleStatusToggle(product)}
                  >
                    {statusUpdatingId === product.id
                      ? 'Wird aktualisiert…'
                      : product.status === 'active'
                        ? 'Deaktivieren'
                        : 'Aktivieren'}
                  </Button>
                </>
              }
            />
          )}
        />
      )}

      <Dialog
        isOpen={Boolean(deactivateTarget)}
        title="Produkt deaktivieren"
        onClose={() => setDeactivateTarget(null)}
        secondaryAction={{ label: 'Abbrechen', onClick: () => setDeactivateTarget(null) }}
        primaryAction={{ label: 'Produkt deaktivieren', variant: 'destructive', onClick: handleDeactivateConfirmed }}
      >
        <p>Das Produkt steht anschließend nicht mehr in der Außendienst-Produktübersicht zur Verfügung.</p>
      </Dialog>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <AdminLayout
      title="Produkte"
      subtitle="BestPay-Hardware und Produkte verwalten"
      actions={createAction}
    >
      {content}
    </AdminLayout>
  );
}
