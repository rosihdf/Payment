import { Link } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import styles from './AdminLayout.module.css';

export function AdminPricingPage() {
  return (
    <AdminLayout title="Tarife und Preise">
      <section className={styles.panel}>
        <p>
          Tarife werden versioniert verwaltet. Aktive Tarifversionen dürfen nicht still überschrieben werden.
          Historische Angebots-Snapshots bleiben unverändert.
        </p>
        <div className={styles.toolbar}>
          <Link to="/admin/tariffs">Tarifverwaltung öffnen</Link>
        </div>
      </section>
      <section className={styles.panel}>
        <h2>Preislisten</h2>
        <p>
          Price Books, Vertragslaufzeiten und Preisregeln werden über die Pricing Engine ausgewertet.
          Die pflegbare Katalogstruktur ist lokal vorhanden und kann administrativ erweitert werden.
        </p>
      </section>
    </AdminLayout>
  );
}

export function AdminProductsPage() {
  return (
    <AdminLayout title="Produkte und Hardware">
      <section className={styles.panel}>
        <p>
          Terminals, Zubehör und Gebührenpositionen werden zentral im Produktkatalog gepflegt.
          Historisch verwendete Produkte werden deaktiviert statt gelöscht.
        </p>
        <div className={styles.toolbar}>
          <Link to="/admin/products/manage">Produktverwaltung öffnen</Link>
          <Link to="/products">Operativer Produktkatalog</Link>
        </div>
      </section>
    </AdminLayout>
  );
}
