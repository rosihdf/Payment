import { useEffect, useState } from 'react';
import { EmptyState } from '../../../components/feedback/EmptyState';
import type { CommissionEvent } from '../../../domain/commission/commissionCase';
import { useServices } from '../../../hooks/useServices';
import { useAdminContext } from '../AdminLayout';
import styles from '../AdminLayout.module.css';
import { AdminCommissionLayout } from './AdminCommissionLayout';

export function CommissionHistoryPanel() {
  const context = useAdminContext();
  const { commissionAdminService } = useServices();
  const [events, setEvents] = useState<CommissionEvent[]>([]);

  useEffect(() => {
    if (!context) return;
    void commissionAdminService.getEvents(context).then((result) => {
      if (!('error' in result)) {
        setEvents([...result].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)));
      }
    });
  }, [commissionAdminService, context]);

  return (
    <section className={styles.panel}>
        {events.length === 0 ? (
          <EmptyState title="Keine Ereignisse" description="Noch keine Provisionsereignisse protokolliert." />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Typ</th>
                <th>Vorher</th>
                <th>Nachher</th>
                <th>Betrag</th>
                <th>Grund</th>
                <th>Benutzer</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.occurredAt}</td>
                  <td>{event.eventType}</td>
                  <td>{event.previousStatus ?? '—'}</td>
                  <td>{event.newStatus ?? '—'}</td>
                  <td>{event.amountCents != null ? `${(event.amountCents / 100).toFixed(2)} €` : '—'}</td>
                  <td>{event.reason}</td>
                  <td>{event.triggeredByUserId}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
    </section>
  );
}

export function AdminCommissionHistoryPage() {
  return (
    <AdminCommissionLayout title="Provision – Historie & Audit">
      <CommissionHistoryPanel />
    </AdminCommissionLayout>
  );
}
