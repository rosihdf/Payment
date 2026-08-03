import { CommissionBonusPanel } from '../../features/admin/commission/AdminCommissionBonusPage';
import { CommissionShell } from './CommissionShell';

export function CommissionBonusPage() {
  return (
    <CommissionShell
      title="Provision – Sonderzahlungen"
      description="Bonuszahlungen anlegen, freigeben und auszahlen"
    >
      <CommissionBonusPanel />
    </CommissionShell>
  );
}
