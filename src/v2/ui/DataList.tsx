import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './DataList.module.css';

export interface DataListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  emptyState?: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function DataList<T>({
  items,
  getKey,
  renderItem,
  emptyState = null,
  className,
  'aria-label': ariaLabel,
}: DataListProps<T>) {
  if (items.length === 0) {
    return emptyState;
  }

  const listClass = className ? `${styles.list} ${className}` : styles.list;

  return (
    <ul className={listClass} aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={getKey(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

export interface DataListCardProps {
  title: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function DataListCard({
  title,
  badge,
  meta,
  footer,
  href,
  onClick,
  className,
}: DataListCardProps) {
  const isInteractive = Boolean(href || onClick);
  const cardClass = [
    styles.card,
    isInteractive ? styles.cardInteractive : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>{title}</div>
        {badge}
      </div>
      {meta ? <div className={styles.cardMeta}>{meta}</div> : null}
    </>
  );

  if (href) {
    return (
      <article className={cardClass}>
        <Link className={styles.cardLink} to={href}>
          {body}
        </Link>
        {footer ? <div className={styles.cardFooter}>{footer}</div> : null}
      </article>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={cardClass} onClick={onClick}>
        {body}
        {footer ? <div className={styles.cardFooter}>{footer}</div> : null}
      </button>
    );
  }

  return (
    <article className={cardClass}>
      {body}
      {footer ? <div className={styles.cardFooter}>{footer}</div> : null}
    </article>
  );
}
