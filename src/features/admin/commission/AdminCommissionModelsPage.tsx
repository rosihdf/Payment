import { useEffect, useState } from 'react';
import { EmptyState } from '../../../components/feedback/EmptyState';
import type { CommissionPlan } from '../../../domain/commission/commissionPlan';
import type { CommissionRule } from '../../../domain/commission/commissionRule';
import { useServices } from '../../../hooks/useServices';
import { useAdminContext } from '../AdminLayout';
import styles from '../AdminLayout.module.css';
import { AdminCommissionLayout } from './AdminCommissionLayout';

export function AdminCommissionModelsPage() {
  const context = useAdminContext();
  const { commissionCatalogAdminService } = useServices();
  const [plans, setPlans] = useState<CommissionPlan[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!context) return;
    void commissionCatalogAdminService.getCatalog(context).then((catalog) => {
      if ('error' in catalog) return;
      setPlans(catalog.commissionPlans);
      setRules(catalog.commissionRules);
    });
  }, [commissionCatalogAdminService, context]);

  const handleSeed = async () => {
    if (!context) return;
    const result = await commissionCatalogAdminService.seedDefaultCatalog(context);
    setMessage(result.ok ? 'Standardkatalog aktiviert' : result.error);
    const catalog = await commissionCatalogAdminService.getCatalog(context);
    if (!('error' in catalog)) {
      setPlans(catalog.commissionPlans);
      setRules(catalog.commissionRules);
    }
  };

  return (
    <AdminCommissionLayout
      title="Provision – Modelle & Regeln"
      actions={
        <button type="button" onClick={() => void handleSeed()}>
          Standardkatalog aktivieren
        </button>
      }
    >
      {message ? <p role="status">{message}</p> : null}
      <section className={styles.panel}>
        <h2>Provisionsmodelle</h2>
        {plans.length === 0 ? (
          <EmptyState title="Kein Katalog" description="Bitte Standardkatalog aktivieren." />
        ) : (
          <ul>
            {plans.map((plan) => (
              <li key={plan.id}>
                <strong>{plan.name}</strong> ({plan.code}) – {plan.description}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.panel}>
        <h2>Regeln</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Typ</th>
              <th>Basis</th>
              <th>Fixbetrag</th>
              <th>Prozent</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>{rule.commissionType}</td>
                <td>{rule.calculationBasis}</td>
                <td>{rule.fixedAmountCents != null ? `${(rule.fixedAmountCents / 100).toFixed(2)} €` : '—'}</td>
                <td>{rule.percentTenthsOfBasisPoint != null ? `${rule.percentTenthsOfBasisPoint / 100} ‰` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminCommissionLayout>
  );
}
