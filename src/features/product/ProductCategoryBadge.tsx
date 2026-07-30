import { PRODUCT_CATEGORY_LABELS, type ProductCategory } from '../../domain/product/product';
import styles from './ProductCategoryBadge.module.css';

interface ProductCategoryBadgeProps {
  category: ProductCategory;
}

export function ProductCategoryBadge({ category }: ProductCategoryBadgeProps) {
  return <span className={styles.badge}>{PRODUCT_CATEGORY_LABELS[category]}</span>;
}
