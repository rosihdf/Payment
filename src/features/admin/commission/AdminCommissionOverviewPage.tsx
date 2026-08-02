import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FormControl } from '../../../components/common/FormControl';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { useServices } from '../../../hooks/useServices';
import { useAdminContext } from '../AdminLayout';
import styles from '../AdminLayout.module.css';
import { AdminCommissionLayout, formatEuro } from './AdminCommissionLayout';
import type { CommissionCaseStatus } from '../../../domain/commission/commissionCase';

export function AdminCommissionOverviewPage() {
  const context = useAdminContext();
  const { commissionAdminService } = useServices();
  const [statusFilter, setStatusFilter] = useState<CommissionCaseStatus | 'all'>('all');
  const [modelFilter, setModelFilter] = useState<'classic' | 'variable' | 'all'>('all');
  const [data, setData] = useState<Awaited<ReturnType<typeof commissionAdminService.getOverview>> | null>(null);

  useEffect(() => {
    if (!context) return;
    void (async () => {
      await commissionAdminService.ensureDefaultAssignments(context);
      const overview = await commissionAdminService.getOverview(context, {
        status: statusFilter,
        model: modelFilter,
      });
      setData(overview);
    })();
  }, [commissionAdminService, context, statusFilter, modelFilter]);

  if (!context) {
    return null;
  }

  if (!data || 'error' in data) {
    return (
      <AdminCommissionLayout title="Provision – Übersicht">
        <EmptyState title="Keine Berechtigung" description="Administration erforderlich." />
      </AdminCommissionLayout>
    );
  }

  return (
    <AdminCommissionLayout
      title="Provision – Übersicht"
      actions={
        <button
          type="button"
          onClick={() => {
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
          }}
        >
          Export CSV
        </button>
      }
    >
      {data.missingAssignments > 0 ? (
        <p className={styles.warningText} role="status">
          {data.missingAssignments} Außendienstmitarbeiter ohne Provisionszuordnung
        </p>
      ) : null}

      <div className={styles.toolbar}>
        <FormControl
          type="select"
          label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as CommissionCaseStatus | 'all')}
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'expected', label: 'Erwartet' },
            { value: 'reserved', label: 'Reserviert' },
            { value: 'released', label: 'Freigegeben' },
            { value: 'settled', label: 'Abgerechnet' },
            { value: 'paid', label: 'Ausgezahlt' },
            { value: 'cancelled', label: 'Storniert' },
          ]}
        />
        <FormControl
          type="select"
          label="Modell"
          value={modelFilter}
          onChange={(event) => setModelFilter(event.target.value as 'classic' | 'variable' | 'all')}
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'classic', label: 'Classic' },
            { value: 'variable', label: 'Variable' },
          ]}
        />
      </div>

      <section className={styles.panel}>
        <h2>Kennzahlen</h2>
        <ul>
          <li>Standardmodell Classic: {data.summary.classicRuleCount} aktive Regeln</li>
          <li>Standardmodell Variable: {data.summary.variableRuleCount} aktive Regeln</li>
          <li>Individuelle Vereinbarungen: {data.summary.individualAgreementCount}</li>
          <li>
            Heute berechnet / erwartet: {data.summary.expectedCaseCount} (
            {formatEuro(data.summary.calculatedCents)})
          </li>
          <li>Wartet auf Freigabe: {data.summary.pendingReleaseCaseCount}</li>
          <li>
            Freigegeben: {data.summary.releasedCaseCount} ({formatEuro(data.summary.releasedCents)})
          </li>
          <li>
            Abgerechnet: {data.summary.settledCaseCount} ({formatEuro(data.summary.settledCents)})
          </li>
          <li>
            Ausgezahlt: {data.summary.paidCaseCount} ({formatEuro(data.summary.paidCents)})
          </li>
          <li>
            Sonderzahlungen: {data.summary.bonusCount} (offen {formatEuro(data.summary.bonusOpenCents)},
            freigegeben {formatEuro(data.summary.bonusApprovedCents)}, ausgezahlt{' '}
            {formatEuro(data.summary.bonusPaidCents)})
          </li>
          <li>Kürzungen: {formatEuro(data.summary.reductionCents)}</li>
          <li>Gesamtauszahlung: {formatEuro(data.summary.totalCents)}</li>
        </ul>
      </section>

      <section className={styles.panel}>
        <h2>Provisionsfälle</h2>
        {data.rows.length === 0 ? (
          <EmptyState title="Keine Fälle" description="Noch keine Provisionsfälle vorhanden." />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mitarbeiter</th>
                <th>Kunde</th>
                <th>Angebot</th>
                <th>Modell</th>
                <th>Status</th>
                <th>Provision</th>
                <th>Nächste Aktion</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.caseId}>
                  <td>{row.salesRepresentativeName}</td>
                  <td>{row.customerName}</td>
                  <td>
                    <Link to={`/offers/${row.offerId}`}>{row.offerId.slice(0, 8)}…</Link>
                  </td>
                  <td>{row.model}</td>
                  <td>{row.statusLabel}</td>
                  <td>{formatEuro(row.amountCents)}</td>
                  <td>{row.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminCommissionLayout>
  );
}
