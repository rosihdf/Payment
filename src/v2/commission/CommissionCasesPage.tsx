import { CommissionCasesPanel } from '../../features/admin/commission/AdminCommissionCasesPage';
import { CommissionShell } from './CommissionShell';

export function CommissionCasesPage() {
  return (
    <CommissionShell
      title="Provision – Provisionsfälle"
      description="Eingefrorene Berechnungen prüfen, freigeben und abrechnen"
    >
      <CommissionCasesPanel />
    </CommissionShell>
  );
}
