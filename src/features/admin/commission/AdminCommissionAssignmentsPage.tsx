import { useEffect, useState } from 'react';
import { FormControl } from '../../../components/common/FormControl';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { useServices } from '../../../hooks/useServices';
import { useAdminContext } from '../AdminLayout';
import styles from '../AdminLayout.module.css';
import { AdminCommissionLayout } from './AdminCommissionLayout';
import type { RepresentativeAssignmentRow } from '../../../services/commissionAdminService';
import type { CommissionRuleOverride } from '../../../domain/commission/commissionRuleOverride';

export function AdminCommissionAssignmentsPage() {
  const context = useAdminContext();
  const { commissionAdminService } = useServices();
  const [rows, setRows] = useState<RepresentativeAssignmentRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [model, setModel] = useState<'classic' | 'variable'>('classic');
  const [validFrom, setValidFrom] = useState('2026-01-01');
  const [validUntil, setValidUntil] = useState('');
  const [overrides, setOverrides] = useState<CommissionRuleOverride[]>([]);
  const [standardOverrides, setStandardOverrides] = useState<CommissionRuleOverride[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!context) return;
    const result = await commissionAdminService.listRepresentativeAssignments(context);
    if (Array.isArray(result)) {
      setRows(result);
    }
  };

  useEffect(() => {
    void load();
  }, [context]);

  useEffect(() => {
    if (!context || !selectedUserId) return;
    void commissionAdminService.getAssignmentDetail(context, selectedUserId).then((detail) => {
      if ('error' in detail) return;
      setModel(detail.model ?? 'classic');
      setStandardOverrides(detail.standardOverrides);
      setOverrides(detail.currentOverrides);
      if (detail.assignment) {
        setValidFrom(detail.assignment.validFrom.slice(0, 10));
        setValidUntil(detail.assignment.validUntil?.slice(0, 10) ?? '');
      }
    });
  }, [commissionAdminService, context, selectedUserId]);

  const handleSave = async () => {
    if (!context || !selectedUserId) return;
    const result = await commissionAdminService.saveAssignment(context, {
      salesRepresentativeId: selectedUserId,
      model,
      validFrom,
      validUntil: validUntil || null,
      ruleOverrides: overrides,
      changeNote: 'Provision eingestellt',
    });
    setMessage(result.ok ? 'Zuordnung gespeichert' : `Fehler: ${result.error}`);
    await load();
  };

  const handleReset = async () => {
    if (!context || !selectedUserId) return;
    const result = await commissionAdminService.resetAssignmentOverrides(context, selectedUserId);
    setMessage(result.ok ? 'Auf Standard zurückgesetzt' : `Fehler: ${result.error}`);
    setOverrides(standardOverrides);
  };

  return (
    <AdminCommissionLayout title="Provision – Mitarbeiter & Zuordnungen">
      <section className={styles.panel}>
        <h2>Außendienst</h2>
        {rows.length === 0 ? (
          <EmptyState title="Keine Mitarbeiter" description="Keine Außendienstmitarbeiter gefunden." />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Status</th>
                <th>Modell</th>
                <th>Gültig ab</th>
                <th>Gültig bis</th>
                <th>Individuell</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId}>
                  <td>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.status}</td>
                  <td>{row.modelLabel}</td>
                  <td>{row.validFrom ?? '—'}</td>
                  <td>{row.validUntil ?? '—'}</td>
                  <td>{row.hasIndividualOverrides ? 'Ja' : 'Nein'}</td>
                  <td>
                    <button type="button" onClick={() => setSelectedUserId(row.userId)}>
                      Provision einstellen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selectedUserId ? (
        <section className={styles.panel}>
          <h2>Provision einstellen</h2>
          <div className={styles.formGrid}>
            <FormControl
              type="select"
              label="Grundmodell"
              value={model}
              onChange={(event) => setModel(event.target.value as 'classic' | 'variable')}
              options={[
                { value: 'classic', label: 'Classic' },
                { value: 'variable', label: 'Variable' },
              ]}
            />
            <FormControl type="date" label="Gültig ab" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            <FormControl
              type="date"
              label="Gültig bis"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>

          <div className={styles.twoColumn}>
            <div>
              <h3>Standardmodell</h3>
              <ul>
                {standardOverrides.map((override) => (
                  <li key={override.ruleId}>
                    {override.ruleId}:{' '}
                    {override.fixedAmountCents != null
                      ? `${(override.fixedAmountCents / 100).toFixed(2)} €`
                      : override.percentTenthsOfBasisPoint != null
                        ? `${override.percentTenthsOfBasisPoint / 100} ‰`
                        : '—'}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Aktuelle Einstellung</h3>
              <ul>
                {overrides.map((override) => (
                  <li key={override.ruleId}>
                    <FormControl
                      type="text"
                      label={override.ruleId}
                      value={
                        override.fixedAmountCents != null
                          ? String(override.fixedAmountCents / 100)
                          : override.percentTenthsOfBasisPoint != null
                            ? String(override.percentTenthsOfBasisPoint / 100)
                            : ''
                      }
                      onChange={(event) => {
                        const value = Number(event.target.value.replace(',', '.'));
                        setOverrides((current) =>
                          current.map((entry) =>
                            entry.ruleId === override.ruleId
                              ? {
                                  ...entry,
                                  fixedAmountCents: Number.isFinite(value)
                                    ? Math.round(value * 100)
                                    : entry.fixedAmountCents,
                                }
                              : entry,
                          ),
                        );
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.toolbar}>
            <button type="button" onClick={() => void handleSave()}>
              Speichern
            </button>
            <button type="button" onClick={() => void handleReset()}>
              Auf Standard zurücksetzen
            </button>
          </div>
          {message ? <p role="status">{message}</p> : null}
        </section>
      ) : null}
    </AdminCommissionLayout>
  );
}
