import type { ReactNode } from 'react';
import styles from './ResponsiveTable.module.css';

export interface ResponsiveTableColumn<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyState?: ReactNode;
  renderActions?: (row: T) => ReactNode;
  /** Listen → Karten; Vergleichstabellen → horizontal scrollen */
  mobileMode?: 'cards' | 'scroll';
  tableClassName?: string;
}

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  emptyState = null,
  renderActions,
  mobileMode = 'cards',
  tableClassName,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return emptyState;
  }

  const mobileColumns = columns.filter((column) => !column.hideOnMobile);
  const tableClass = tableClassName ? `${styles.table} ${tableClassName}` : styles.table;

  return (
    <>
      <div className={mobileMode === 'cards' ? styles.desktopTable : styles.scrollContainer}>
        <div className={styles.tableWrap}>
          <table className={tableClass}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.id} scope="col">
                    {column.header}
                  </th>
                ))}
                {renderActions ? <th scope="col" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.id}>{column.render(row)}</td>
                  ))}
                  {renderActions ? <td>{renderActions(row)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {mobileMode === 'cards' ? (
        <ul className={styles.mobileList}>
          {rows.map((row) => (
            <li key={rowKey(row)} className={styles.mobileCard}>
              {mobileColumns.map((column) => (
                <div key={column.id} className={styles.mobileRow}>
                  <span className={styles.mobileLabel}>{column.header}</span>
                  <span className={styles.mobileValue}>{column.render(row)}</span>
                </div>
              ))}
              {renderActions ? <div className={styles.mobileActions}>{renderActions(row)}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
