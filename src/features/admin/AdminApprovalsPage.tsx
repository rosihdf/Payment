import { useEffect, useState } from 'react';
import type { ApprovalRule } from '../../domain/approvalRule/approvalRule';
import { APPROVAL_RULE_TYPE_LABELS } from '../../domain/approvalRule/approvalRule';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AdminLayout, useAdminContext } from './AdminLayout';
import { useServices } from '../../hooks/useServices';
import styles from './AdminLayout.module.css';

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

  return (
    <AdminLayout title="Freigaberegeln">
      {simulation ? <p role="status">{simulation}</p> : null}
      {rules.length === 0 ? (
        <EmptyState title="Keine Regeln" description="Es sind keine Freigaberegeln vorhanden." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Typ</th>
                <th>Status</th>
                <th>Priorität</th>
                <th>Vier-Augen</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  <td>{APPROVAL_RULE_TYPE_LABELS[rule.type]}</td>
                  <td>{rule.status}</td>
                  <td>{rule.priority}</td>
                  <td>{rule.fourEyesRequired ? 'Ja' : 'Nein'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
