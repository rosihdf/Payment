import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { PricingCatalogData } from '../../repositories/interfaces/PricingCatalogRepository';
import { LocalPricingCatalogRepository } from '../../repositories/local/LocalPricingCatalogRepository';
import { formatCentsToCurrency } from '../../utils/currency';
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
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Versionen</th>
                </tr>
              </thead>
              <tbody>
                {catalog.priceBooks.map((book) => {
                  const versions = catalog.priceBookVersions.filter(
                    (version) => version.priceBookId === book.id,
                  );
                  return (
                    <tr key={book.id}>
                      <td>{book.name}</td>
                      <td>{book.code}</td>
                      <td>
                        {versions.length === 0
                          ? '—'
                          : versions
                              .map(
                                (version) =>
                                  `v${version.versionNumber} (${PRICE_BOOK_VERSION_STATUS_LABELS[version.status]})`,
                              )
                              .join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Priorität</th>
                  <th>Listenpreis</th>
                </tr>
              </thead>
              <tbody>
                {catalog.priceRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>{PRICE_RULE_STATUS_LABELS[rule.status]}</td>
                    <td>{rule.priority}</td>
                    <td>
                      {rule.listPriceCents == null
                        ? '—'
                        : formatCentsToCurrency(rule.listPriceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
