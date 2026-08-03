import type { ReactNode } from 'react';
import styles from './ResponsiveTable.module.css';

export interface ResponsiveTableColumn<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  hideOnMobile?: boolean;
  /** Align numeric values without wrapping the whole row */
  numeric?: boolean;
}

export type ResponsiveTableMobileMode = 'cards' | 'scroll';

export interface ResponsiveTableProps<T> {
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyState?: ReactNode;
  renderActions?: (row: T) => ReactNode;
  /** cards: label/value cards; scroll: horizontal table on mobile */
  mobileMode?: ResponsiveTableMobileMode;
  tableClassName?: string;
  caption?: string;
  ariaLabel?: string;
  actionsColumnLabel?: string;
  density?: 'default' | 'compact';
}

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  emptyState = null,
  renderActions,
  mobileMode = 'cards',
  tableClassName,
  caption,
  ariaLabel,
  actionsColumnLabel = 'Aktionen',
  density = 'default',
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return emptyState;
  }

  const mobileColumns = columns.filter((column) => !column.hideOnMobile);
  const tableClass = [
    styles.table,
    density === 'compact' ? styles.compact : '',
    tableClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className={mobileMode === 'cards' ? styles.desktopTable : styles.scrollContainer}>
        <div className={styles.tableWrap}>
          <table className={tableClass} aria-label={ariaLabel}>
            {caption ? <caption>{caption}</caption> : null}
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.id} scope="col">
                    {column.header}
                  </th>
                ))}
                {renderActions ? (
                  <th scope="col" aria-label={actionsColumnLabel}>
                    <span aria-hidden="true">{'\u00A0'}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={column.numeric ? styles.numeric : undefined}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                  {renderActions ? <td>{renderActions(row)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {mobileMode === 'cards' ? (
        <ul className={styles.mobileList} aria-label={ariaLabel}>
          {rows.map((row) => (
            <li key={rowKey(row)} className={styles.mobileCard}>
              {mobileColumns.map((column) => (
                <div key={column.id} className={styles.mobileRow}>
                  <span className={styles.mobileLabel}>{column.header}</span>
                  <span
                    className={`${styles.mobileValue} ${column.numeric ? styles.numeric : ''}`.trim()}
                  >
                    {column.render(row)}
                  </span>
                </div>
              ))}
              {renderActions ? (
                <div className={styles.mobileActions}>{renderActions(row)}</div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
