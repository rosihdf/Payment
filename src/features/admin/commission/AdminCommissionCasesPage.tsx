import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FormControl } from '../../../components/common/FormControl';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { useServices } from '../../../hooks/useServices';
import { useAdminContext } from '../AdminLayout';
import styles from '../AdminLayout.module.css';
import { AdminCommissionLayout, formatEuro } from './AdminCommissionLayout';
import type { CommissionCaseStatus } from '../../../domain/commission/commissionCase';
import type { CommissionOverviewRow } from '../../../services/commissionAdminService';

export function AdminCommissionCasesPage() {
  const context = useAdminContext();
  const { commissionAdminService } = useServices();
  const [rows, setRows] = useState<CommissionOverviewRow[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [reductionAmount, setReductionAmount] = useState('');
  const [reductionReason, setReductionReason] = useState('');
  const [accountingReference, setAccountingReference] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!context) return;
    const result = await commissionAdminService.getOverview(context);
    if (!('error' in result)) {
      setRows(result.rows);
    }
  };

  useEffect(() => {
    void load();
  }, [context]);

  const selected = rows.find((row) => row.caseId === selectedCaseId) ?? null;

  const runTransition = async (targetStatus: CommissionCaseStatus, extra?: Record<string, unknown>) => {
    if (!context || !selectedCaseId) return;
    const result = await commissionAdminService.transitionCase(context, selectedCaseId, targetStatus, extra);
    setMessage(result.ok ? `Status: ${result.commissionCase.status}` : `Fehler: ${result.error}`);
    await load();
  };

  return (
    <AdminCommissionLayout title="Provision – Provisionsfälle">
      <section className={styles.panel}>
        {rows.length === 0 ? (
          <EmptyState title="Keine Provisionsfälle" description="Noch keine eingefrorenen Berechnungen." />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mitarbeiter</th>
                <th>Kunde</th>
                <th>Angebot</th>
                <th>Standard</th>
                <th>Anteil</th>
                <th>Endbetrag</th>
                <th>Sonderzahlung</th>
                <th>Kürzung</th>
                <th>Version</th>
                <th>Status</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.caseId}>
                  <td>{row.salesRepresentativeName}</td>
                  <td>{row.customerName}</td>
                  <td>
                    <Link to={`/offers/${row.offerId}`}>{row.offerId.slice(0, 8)}…</Link>
                  </td>
                  <td title={row.appliedRuleNames}>{row.standardLabel}</td>
                  <td>{row.shareSummary}</td>
                  <td>{formatEuro(row.endAmountCents)}</td>
                  <td>{formatEuro(row.bonusAmountCents)}</td>
                  <td>{formatEuro(row.reductionAmountCents)}</td>
                  <td>{row.planVersionLabel}</td>
                  <td>{row.statusLabel}</td>
                  <td>
                    <button type="button" onClick={() => setSelectedCaseId(row.caseId)}>
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selected ? (
        <section className={styles.panel}>
          <h2>Fall bearbeiten</h2>
          <ul>
            <li>Standard: {selected.standardLabel}</li>
            <li>Anteil / Prozent: {selected.shareSummary}</li>
            <li>Endbetrag: {formatEuro(selected.endAmountCents)}</li>
            <li>Sonderzahlung in Berechnung: {formatEuro(selected.bonusAmountCents)}</li>
            <li>Kürzung: {formatEuro(selected.reductionAmountCents)}</li>
            <li>Version: {selected.planVersionLabel}</li>
            <li>Regeln: {selected.appliedRuleNames}</li>
          </ul>
          <div className={styles.toolbar}>
            <button type="button" onClick={() => void runTransition('reserved')}>
              Reservieren
            </button>
            <button type="button" onClick={() => void runTransition('released')}>
              Freigeben
            </button>
            <button
              type="button"
              onClick={() => void runTransition('settled', { accountingReference })}
            >
              Abrechnen
            </button>
            <button
              type="button"
              onClick={() =>
                void runTransition('paid', {
                  paymentDate,
                  paymentReference,
                  paymentAmountCents: undefined,
                })
              }
            >
              Auszahlung dokumentieren
            </button>
            <button type="button" onClick={() => void runTransition('cancelled')}>
              Stornieren
            </button>
          </div>

          <div className={styles.formGrid}>
            <FormControl
              type="text"
              label="Kürzung (EUR)"
              value={reductionAmount}
              onChange={(e) => setReductionAmount(e.target.value)}
            />
            <FormControl
              type="text"
              label="Kürzungsgrund"
              value={reductionReason}
              onChange={(e) => setReductionReason(e.target.value)}
            />
            <button
              type="button"
              onClick={() =>
                void runTransition('released', {
                  reductionAmountCents: Math.round(Number(reductionAmount.replace(',', '.')) * 100),
                  reductionReason,
                })
              }
            >
              Kürzung speichern
            </button>
            <FormControl
              type="text"
              label="Abrechnungsreferenz"
              value={accountingReference}
              onChange={(e) => setAccountingReference(e.target.value)}
            />
            <FormControl
              type="date"
              label="Zahlungsdatum"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
            <FormControl
              type="text"
              label="Zahlungsreferenz"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
          </div>
          {message ? <p role="status">{message}</p> : null}
        </section>
      ) : null}
    </AdminCommissionLayout>
  );
}
