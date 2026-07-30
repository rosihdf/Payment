import type { ReactNode } from 'react';
import type { Product } from '../../domain/product/product';
import { formatTerminalTypes } from '../../utils/formatTerminalTypes';
import { ProductCategoryBadge } from './ProductCategoryBadge';
import { ProductPriceDisplay } from './ProductPriceDisplay';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  showSource?: boolean;
  actions?: ReactNode;
}

export function ProductCard({
  product,
  showSource = false,
  actions,
}: ProductCardProps) {
  const topFeatures = [...product.includedFeatures, ...product.technicalFeatures].slice(0, 4);

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{product.name}</h2>
          <p className={styles.code}>{product.internalProductCode} (intern)</p>
        </div>
        <ProductCategoryBadge category={product.category} />
      </div>

      <dl className={styles.details}>
        {product.modelName ? (
          <div className={styles.row}>
            <dt>Modell</dt>
            <dd>{product.modelName}</dd>
          </div>
        ) : null}
        {product.manufacturer ? (
          <div className={styles.row}>
            <dt>Hersteller</dt>
            <dd>{product.manufacturer}</dd>
          </div>
        ) : null}
        <div className={styles.row}>
          <dt>Einsatzarten</dt>
          <dd>{formatTerminalTypes(product.supportedTerminalTypes) || '—'}</dd>
        </div>
        <div className={styles.row}>
          <dt>Preis</dt>
          <dd>
            <ProductPriceDisplay product={product} />
          </dd>
        </div>
      </dl>

      {product.description ? <p className={styles.description}>{product.description}</p> : null}

      {topFeatures.length > 0 ? (
        <ul className={styles.features}>
          {topFeatures.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      ) : null}

      {showSource && product.sourceReference ? (
        <p className={styles.source}>Quelle: {product.sourceReference}</p>
      ) : null}

      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </article>
  );
}
