import { useEffect, useState } from 'react';
import type { ApprovalRule } from '../../domain/approvalRule/approvalRule';
import { APPROVAL_RULE_TYPE_LABELS } from '../../domain/approvalRule/approvalRule';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AdminLayout, useAdminContext } from '../../features/admin/AdminLayout';
import { useServices } from '../../hooks/useServices';
import { ResponsiveTable, type ResponsiveTableColumn } from '../ui/ResponsiveTable';
import { StatusBadge } from '../ui/StatusBadge';

export function AdminApprovalsPage() {
  const context = useAdminContext();
  const { approvalRuleService } = useServices();
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [simulation, setSimulation] = useState<string | null>(null);

  useEffect(() => {
    if (!context) {
      return;
    }
    void approvalRuleService.getRules(context).then((result) => {
      if (Array.isArray(result)) {
        setRules(result);
        const sim = approvalRuleService.simulateApproval(
          {
            requestedPriceCents: 8000,
            listPriceCents: 10000,
            discountPercentTenths: 2000,
            contractTermMonths: 24,
            contractModelCode: 'terminal_plus_acq',
            tariffId: null,
            hasMissingRequiredData: false,
          },
          result,
        );
        setSimulation(
          sim.approvalRequired
            ? `Freigabe erforderlich: ${sim.reasons.join('; ')}`
            : 'Keine Freigabe erforderlich',
        );
      }
    });
  }, [approvalRuleService, context]);

  const columns: ResponsiveTableColumn<ApprovalRule>[] = [
    { id: 'name', header: 'Name', render: (rule) => rule.name },
    { id: 'type', header: 'Typ', render: (rule) => APPROVAL_RULE_TYPE_LABELS[rule.type] },
    {
      id: 'status',
      header: 'Status',
      render: (rule) => (
        <StatusBadge
          variant={rule.status === 'active' ? 'success' : 'neutral'}
          label={rule.status === 'active' ? 'Aktiv' : 'Inaktiv'}
        />
      ),
    },
    { id: 'priority', header: 'Priorität', render: (rule) => rule.priority, numeric: true },
    {
      id: 'fourEyes',
      header: 'Vier-Augen',
      render: (rule) => (rule.fourEyesRequired ? 'Ja' : 'Nein'),
    },
  ];

  return (
    <AdminLayout title="Freigaberegeln">
      {simulation ? <p role="status">{simulation}</p> : null}
      {rules.length === 0 ? (
        <EmptyState title="Keine Regeln" description="Es sind keine Freigaberegeln vorhanden." />
      ) : (
        <ResponsiveTable
          ariaLabel="Freigaberegeln"
          columns={columns}
          rows={rules}
          rowKey={(rule) => rule.id}
        />
      )}
    </AdminLayout>
  );
}
