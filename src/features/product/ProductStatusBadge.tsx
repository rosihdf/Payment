import { PRODUCT_STATUS_LABELS, type ProductStatus } from '../../domain/product/product';
import styles from './ProductStatusBadge.module.css';

interface ProductStatusBadgeProps {
  status: ProductStatus;
}

export function ProductStatusBadge({ status }: ProductStatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${status === 'active' ? styles.active : styles.inactive}`}>
      {PRODUCT_STATUS_LABELS[status]}
    </span>
  );
}
