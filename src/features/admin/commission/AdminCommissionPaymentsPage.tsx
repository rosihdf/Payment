import { useEffect, useState } from 'react';
import { EmptyState } from '../../../components/feedback/EmptyState';
import type { CommissionPaymentRecord } from '../../../domain/commission/commissionPaymentRecord';
import { useServices } from '../../../hooks/useServices';
import { useAdminContext } from '../AdminLayout';
import styles from '../AdminLayout.module.css';
import { AdminCommissionLayout, formatEuro } from './AdminCommissionLayout';

export function CommissionPaymentsPanel() {
  const context = useAdminContext();
  const { commissionAdminService } = useServices();
  const [payments, setPayments] = useState<CommissionPaymentRecord[]>([]);

  useEffect(() => {
    if (!context) return;
    void commissionAdminService.getPaymentHistory(context).then((result) => {
      if (!('error' in result)) {
        setPayments(result);
      }
    });
  }, [commissionAdminService, context]);

  return (
    <section className={styles.panel}>
        {payments.length === 0 ? (
          <EmptyState title="Keine Zahlungen" description="Noch keine Auszahlungen dokumentiert." />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Fall</th>
                <th>Datum</th>
                <th>Referenz</th>
                <th>Betrag</th>
                <th>Notiz</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.commissionCaseId.slice(0, 12)}…</td>
                  <td>{payment.paymentDate}</td>
                  <td>{payment.paymentReference}</td>
                  <td>{formatEuro(payment.amountCents)}</td>
                  <td>{payment.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
    </section>
  );
}

export function AdminCommissionPaymentsPage() {
  return (
    <AdminCommissionLayout title="Provision – Abrechnung & Zahlungen">
      <CommissionPaymentsPanel />
    </AdminCommissionLayout>
  );
}
