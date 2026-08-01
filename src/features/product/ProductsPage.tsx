import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../components/feedback/EmptyState';
import { FormControl } from '../../components/common/FormControl';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_CATEGORY_ORDER,
  type Product,
  type ProductCategoryFilter,
  type ProductTerminalTypeFilter,
} from '../../domain/product/product';
import { TERMINAL_TYPE_LABELS } from '../../domain/tariff/tariff';
import { useServices } from '../../hooks/useServices';
import type { ProductFilters } from '../../services/productService';
import { ProductCard } from './ProductCard';
import styles from './ProductsPage.module.css';

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

export function ProductsPage() {
  const { productService } = useServices();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    status: 'active',
    category: 'all',
    terminalType: 'all',
  });

  const loadProducts = useCallback(async () => {
    const activeProducts = await productService.getActiveProducts();
    setProducts(activeProducts);
    setIsLoading(false);
  }, [productService]);

  useEffect(() => {
    setIsLoading(true);
    void loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(
    () => productService.filterProducts(products, filters),
    [filters, productService, products],
  );

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, Product[]>();

    for (const category of PRODUCT_CATEGORY_ORDER) {
      const items = filteredProducts.filter((product) => product.category === category);
      if (items.length > 0) {
        groups.set(PRODUCT_CATEGORY_LABELS[category], items);
      }
    }

    return groups;
  }, [filteredProducts]);

  return (
    <section>
      <PageHeader
        title="Produkte"
        subtitle="BestPay-Hardware, Kassensysteme, Zubehör und Dienstleistungen"
      />

      <div className={styles.toolbar}>
        <FormControl
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
        <EmptyState title="Produkte werden geladen" description="Der Produktkatalog wird vorbereitet." />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="Keine Produkte gefunden"
          description="Für die aktuelle Suche oder Filterkombination liegen keine aktiven Produkte vor."
        />
      ) : (
        <div className={styles.groups}>
          {[...groupedProducts.entries()].map(([groupTitle, items]) => (
            <section key={groupTitle} className={styles.group}>
              <h2 className={styles.groupTitle}>{groupTitle}</h2>
              <ul className={styles.list}>
                {items.map((product) => (
                  <li key={product.id}>
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
