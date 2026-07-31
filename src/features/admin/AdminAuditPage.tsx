import { useEffect, useState } from 'react';
import type { AuditEntry } from '../../domain/audit/auditEntry';
import { AUDIT_ACTION_LABELS } from '../../domain/audit/auditEntry';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AdminLayout, useAdminContext } from './AdminLayout';
import { useServices } from '../../hooks/useServices';
import styles from './AdminLayout.module.css';

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

  return (
    <AdminLayout title="Audit">
      {entries.length === 0 ? (
        <EmptyState title="Keine Audit-Einträge" description="Es wurden noch keine administrativen Änderungen protokolliert." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Zeitpunkt</th>
                <th>Benutzer</th>
                <th>Aktion</th>
                <th>Zusammenfassung</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.timestamp).toLocaleString('de-DE')}</td>
                  <td>{entry.userDisplayName}</td>
                  <td>{AUDIT_ACTION_LABELS[entry.action]}</td>
                  <td>{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
