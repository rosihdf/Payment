import { useAdminContext } from '../../features/admin/AdminLayout';
import { CommissionOverviewPanel } from '../../features/admin/commission/AdminCommissionOverviewPage';
import { useServices } from '../../hooks/useServices';
import { Button } from '../ui/Button';
import { CommissionShell } from './CommissionShell';

export function CommissionOverviewPage() {
  const context = useAdminContext();
  const { commissionAdminService } = useServices();

  const handleExport = () => {
    if (!context) return;
    void commissionAdminService.exportOverviewCsv(context).then((csv) => {
      if (typeof csv === 'string') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'provision-uebersicht.csv';
        anchor.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  return (
    <CommissionShell
      title="Provision – Übersicht"
      description="Kennzahlen und Provisionsfälle im Überblick"
      actions={
        <Button variant="secondary" onClick={handleExport}>
          Export CSV
        </Button>
      }
    >
      <CommissionOverviewPanel />
    </CommissionShell>
  );
}
