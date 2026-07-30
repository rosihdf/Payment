import { PageHeader } from '../../components/layout/PageHeader';
import styles from './CalculatorPage.module.css';

export function CalculatorPage() {
  return (
    <section>
      <PageHeader
        title="Vergleichsrechner"
        subtitle="Gegenüberstellung zwischen aktuellem Payment-Anbieter und BestPay"
      />

      <div className={styles.layout}>
        <div className={styles.columns}>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Aktueller Anbieter</h2>
            <p className={styles.panelDescription}>
              Konditionen und Gebühren des bestehenden Payment-Anbieters des Interessenten.
            </p>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <span className={styles.label}>Anbieter</span>
                <div className={styles.placeholder}>Noch kein Anbieter erfasst</div>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Transaktionsgebühr</span>
                <div className={styles.placeholder}>Noch keine Gebühr erfasst</div>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Monatliche Grundgebühr</span>
                <div className={styles.placeholder}>Noch keine Grundgebühr erfasst</div>
              </div>
            </div>
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>BestPay</h2>
            <p className={styles.panelDescription}>
              Angebot auf Basis der verfügbaren BestPay-Tarife für den Vergleich.
            </p>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <span className={styles.label}>Tarif</span>
                <div className={styles.placeholder}>Noch kein Tarif ausgewählt</div>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Transaktionsgebühr</span>
                <div className={styles.placeholder}>Noch keine Gebühr hinterlegt</div>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Monatliche Grundgebühr</span>
                <div className={styles.placeholder}>Noch keine Grundgebühr hinterlegt</div>
              </div>
            </div>
          </article>
        </div>

        <section className={styles.result} aria-label="Vergleichsergebnis">
          <h2 className={styles.resultTitle}>Ergebnis</h2>
          <div className={styles.resultContent}>
            Sobald beide Seiten ausgefüllt sind, erscheint hier die Vergleichsauswertung.
          </div>
        </section>
      </div>
    </section>
  );
}
