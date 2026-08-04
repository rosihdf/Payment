import { NavLink, useSearchParams } from 'react-router-dom';
import { AdminProductsPage } from '../../features/product/AdminProductsPage';
import { AdminTariffsPage } from '../../features/tariff/AdminTariffsPage';
import type { AdminCatalogTab } from '../../utils/routes';
import { adminCatalogPath } from '../../utils/routes';
import { AdminLayout } from '../../features/admin/AdminLayout';
import { AdminPriceRulesPanel } from '../../features/admin/AdminPriceRulesPanel';
import styles from '../../features/admin/AdminLayout.module.css';

const CATALOG_TABS: Array<{ id: AdminCatalogTab; label: string }> = [
  { id: 'tariffs', label: 'Tarife' },
  { id: 'products', label: 'Produkte' },
  { id: 'rules', label: 'Preisregeln' },
];

function resolveCatalogTab(value: string | null): AdminCatalogTab {
  if (value === 'products' || value === 'rules' || value === 'tariffs') {
    return value;
  }
  return 'tariffs';
}

export function AdminCatalogPage() {
  const [searchParams] = useSearchParams();
  const activeTab = resolveCatalogTab(searchParams.get('tab'));

  return (
    <AdminLayout
      title="Produkte & Konditionen"
      subtitle="Tarife, Produkte und vorhandene Preisregeln an einem Ort"
    >
      <nav className={styles.subnav} aria-label="Produkte & Konditionen">
        {CATALOG_TABS.map((tab) => (
          <NavLink
            key={tab.id}
            to={adminCatalogPath(tab.id)}
            className={() =>
              activeTab === tab.id
                ? `${styles.subnavLink} ${styles.subnavLinkActive}`
                : styles.subnavLink
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {activeTab === 'tariffs' ? <AdminTariffsPage embedded /> : null}
      {activeTab === 'products' ? <AdminProductsPage embedded /> : null}
      {activeTab === 'rules' ? <AdminPriceRulesPanel /> : null}
    </AdminLayout>
  );
}
