import { CommissionAssignmentsPanel } from '../../features/admin/commission/AdminCommissionAssignmentsPage';
import { CommissionModelsPanel } from '../../features/admin/commission/AdminCommissionModelsPage';
import { CommissionShell } from './CommissionShell';
import styles from './CommissionPage.module.css';

export function CommissionStandardsPage() {
  return (
    <CommissionShell
      title="Provision – Standard & Vereinbarungen"
      description="Unternehmensweite Standardprovisionen und individuelle Mitarbeitervereinbarungen"
    >
      <div className={styles.sectionStack}>
        <div>
          <h2 className={styles.panelTitle}>Standardprovisionen</h2>
          <CommissionModelsPanel />
        </div>
        <div>
          <h2 className={styles.panelTitle}>Mitarbeiter & Vereinbarungen</h2>
          <CommissionAssignmentsPanel />
        </div>
      </div>
    </CommissionShell>
  );
}
