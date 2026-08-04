import { useEffect, useState } from 'react';
import type { AuditEntry } from '../../domain/audit/auditEntry';
import { AUDIT_ACTION_LABELS } from '../../domain/audit/auditEntry';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AdminLayout, useAdminContext } from '../../features/admin/AdminLayout';
import { useServices } from '../../hooks/useServices';
import { ResponsiveTable, type ResponsiveTableColumn } from '../ui/ResponsiveTable';

export function AdminAuditPage() {
  const context = useAdminContext();
  const { auditService } = useServices();
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!context) {
      return;
    }
    void auditService.getEntries(context).then((result) => {
      if (Array.isArray(result)) {
        setEntries(result);
      }
    });
  }, [auditService, context]);

  const columns: ResponsiveTableColumn<AuditEntry>[] = [
    { id: 'timestamp', header: 'Zeitpunkt', render: (entry) => new Date(entry.timestamp).toLocaleString('de-DE') },
    { id: 'user', header: 'Benutzer', render: (entry) => entry.userDisplayName },
    { id: 'action', header: 'Aktion', render: (entry) => AUDIT_ACTION_LABELS[entry.action] },
    { id: 'summary', header: 'Zusammenfassung', render: (entry) => entry.summary },
  ];

  return (
    <AdminLayout title="Audit">
      {entries.length === 0 ? (
        <EmptyState
          title="Keine Audit-Einträge"
          description="Es wurden noch keine administrativen Änderungen protokolliert."
        />
      ) : (
        <ResponsiveTable
          ariaLabel="Audit-Log"
          columns={columns}
          rows={entries}
          rowKey={(entry) => entry.id}
        />
      )}
    </AdminLayout>
  );
}
