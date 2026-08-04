import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { PriceBook, PriceBookVersion } from '../../domain/pricing/priceBook';
import type { PriceRule } from '../../domain/pricing/priceRule';
import type { PricingCatalogData } from '../../repositories/interfaces/PricingCatalogRepository';
import { LocalPricingCatalogRepository } from '../../repositories/local/LocalPricingCatalogRepository';
import { formatCentsToCurrency } from '../../utils/currency';
import { ResponsiveTable, type ResponsiveTableColumn } from '../../v2/ui/ResponsiveTable';
import styles from './AdminLayout.module.css';

const PRICE_RULE_STATUS_LABELS = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
} as const;

const PRICE_BOOK_VERSION_STATUS_LABELS = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  archived: 'Archiviert',
} as const;

export function AdminPriceRulesPanel() {
  const [catalog, setCatalog] = useState<PricingCatalogData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const repository = new LocalPricingCatalogRepository();
      const data = await repository.getCatalog();
      if (!cancelled) {
        setCatalog(data);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading || !catalog) {
    return (
      <EmptyState
        title="Preisregeln werden geladen"
        description="Der vorhandene Pricing-Katalog wird gelesen."
      />
    );
  }

  return (
    <div className={styles.content}>
      <section className={styles.panel}>
        <h2>Pflegezustand</h2>
        <p>
          Preisregeln werden von der Pricing Engine ausgewertet. Es gibt derzeit keine separate
          Bearbeitungsmaske. Angezeigt wird nur der vorhandene Katalogbestand – ohne neue Preise
          oder Regeln zu erzeugen.
        </p>
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>{catalog.priceBooks.length}</div>
            <div className={styles.metricLabel}>Price Books</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>{catalog.priceBookVersions.length}</div>
            <div className={styles.metricLabel}>Versionen</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>{catalog.contractTerms.length}</div>
            <div className={styles.metricLabel}>Vertragslaufzeiten</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>{catalog.priceRules.length}</div>
            <div className={styles.metricLabel}>Preisregeln</div>
          </div>
        </div>
      </section>

      {catalog.priceBooks.length > 0 ? (
        <section className={styles.panel}>
          <h2>Price Books</h2>
          <ResponsiveTable
            ariaLabel="Price Books"
            rowKey={(book) => book.id}
            rows={catalog.priceBooks}
            columns={priceBookColumns(catalog.priceBookVersions)}
          />
        </section>
      ) : null}

      {catalog.priceRules.length === 0 ? (
        <EmptyState
          title="Keine Preisregeln vorhanden"
          description="Im lokalen Katalog sind derzeit keine Price Rules gespeichert. Eine Vollverwaltung wird hier nicht nachgebildet."
        />
      ) : (
        <section className={styles.panel}>
          <h2>Preisregeln</h2>
          <ResponsiveTable
            ariaLabel="Preisregeln"
            rowKey={(rule) => rule.id}
            rows={catalog.priceRules}
            columns={priceRuleColumns}
          />
        </section>
      )}
    </div>
  );
}

function priceBookColumns(versions: PriceBookVersion[]): ResponsiveTableColumn<PriceBook>[] {
  return [
    { id: 'name', header: 'Name', render: (book) => book.name },
    { id: 'code', header: 'Code', render: (book) => book.code },
    {
      id: 'versions',
      header: 'Versionen',
      render: (book) => {
        const bookVersions = versions.filter((version) => version.priceBookId === book.id);
        return bookVersions.length === 0
          ? '—'
          : bookVersions
              .map(
                (version) =>
                  `v${version.versionNumber} (${PRICE_BOOK_VERSION_STATUS_LABELS[version.status]})`,
              )
              .join(', ');
      },
    },
  ];
}

const priceRuleColumns: ResponsiveTableColumn<PriceRule>[] = [
  { id: 'name', header: 'Name', render: (rule) => rule.name },
  { id: 'status', header: 'Status', render: (rule) => PRICE_RULE_STATUS_LABELS[rule.status] },
  { id: 'priority', header: 'Priorität', render: (rule) => rule.priority, numeric: true },
  {
    id: 'listPrice',
    header: 'Listenpreis',
    render: (rule) => (rule.listPriceCents == null ? '—' : formatCentsToCurrency(rule.listPriceCents)),
  },
];
