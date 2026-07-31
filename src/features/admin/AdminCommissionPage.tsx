import { useEffect, useState } from 'react';
import { AdminLayout, useAdminContext } from './AdminLayout';
import { useServices } from '../../hooks/useServices';
import styles from './AdminLayout.module.css';

export function AdminCommissionPage() {
  const context = useAdminContext();
  const { commissionCatalogAdminService } = useServices();
  const [previewAmount, setPreviewAmount] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!context) {
      return;
    }
    void commissionCatalogAdminService
      .previewCommission(context, {
        contractTypeCode: 'terminal_plus_acq',
        termMonths: 36,
        transactionVolumeCents: 100000,
        clearingVolumeCents: 50000,
        terminalRentalCents: 2000,
        accessorySaleCents: 5000,
      })
      .then((result) => {
        if ('error' in result) {
          return;
        }
        setPreviewAmount(result.finalExpectedCommissionAmountCents);
      });
  }, [commissionCatalogAdminService, context]);

  const handleSeed = async () => {
    if (!context) {
      return;
    }
    const result = await commissionCatalogAdminService.seedDefaultCatalog(context);
    setMessage(result.ok ? 'Classic/Variable Provisionskatalog aktiviert' : result.error);
  };

  return (
    <AdminLayout
      title="Provision"
      actions={
        <button type="button" onClick={() => void handleSeed()}>
          Standardkatalog aktivieren
        </button>
      }
    >
      <section className={styles.panel}>
        <p>
          Classic: Terminal+ACQ 300 €, Terminal 200 €, ACQ 150 €. Variable: halbe Festbeträge plus 30 %
          Beteiligungen und 20 % Zubehör.
        </p>
        {message ? <p role="status">{message}</p> : null}
        {previewAmount !== null ? (
          <p>Vorschau (Engine): {(previewAmount / 100).toFixed(2)} €</p>
        ) : null}
      </section>
    </AdminLayout>
  );
}
