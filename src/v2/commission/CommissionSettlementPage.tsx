import { CommissionHistoryPanel } from '../../features/admin/commission/AdminCommissionHistoryPage';
import { CommissionPaymentsPanel } from '../../features/admin/commission/AdminCommissionPaymentsPage';
import { CommissionShell } from './CommissionShell';
import styles from './CommissionPage.module.css';

export function CommissionSettlementPage() {
  return (
    <CommissionShell
      title="Provision – Abrechnung & Historie"
      description="Auszahlungen dokumentieren und Provisionsereignisse nachverfolgen"
    >
      <div className={styles.sectionStack}>
        <div>
          <h2 className={styles.panelTitle}>Abrechnung & Zahlungen</h2>
          <CommissionPaymentsPanel />
        </div>
        <div>
          <h2 className={styles.panelTitle}>Historie & Audit</h2>
          <CommissionHistoryPanel />
        </div>
      </div>
    </CommissionShell>
  );
}
