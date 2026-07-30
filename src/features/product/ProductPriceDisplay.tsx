import type { Product } from '../../domain/product/product';
import { formatProductPrice, formatProductPriceTypeLabel } from '../../utils/formatProduct';
import styles from './ProductPriceDisplay.module.css';

interface ProductPriceDisplayProps {
  product: Pick<
    Product,
    | 'priceType'
    | 'priceCents'
    | 'secondaryPriceType'
    | 'secondaryPriceCents'
    | 'secondaryPriceLabel'
    | 'unitLabel'
  >;
  compact?: boolean;
}

export function ProductPriceDisplay({ product, compact = false }: ProductPriceDisplayProps) {
  return (
    <div className={styles.prices}>
      <div className={styles.primary}>
        <span className={styles.amount}>{formatProductPrice(product.priceType, product.priceCents)}</span>
        {!compact ? (
          <span className={styles.meta}>
            {formatProductPriceTypeLabel(product.priceType)}
            {product.unitLabel ? ` · ${product.unitLabel}` : ''}
          </span>
        ) : null}
      </div>

      {product.secondaryPriceType && product.secondaryPriceCents !== null && product.secondaryPriceLabel ? (
        <div className={styles.secondary}>
          <span className={styles.secondaryLabel}>{product.secondaryPriceLabel}</span>
          <span className={styles.secondaryAmount}>
            {formatProductPrice(product.secondaryPriceType, product.secondaryPriceCents)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
