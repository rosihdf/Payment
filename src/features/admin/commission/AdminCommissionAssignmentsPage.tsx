import { useEffect, useState } from 'react';
import { FormControl } from '../../../components/common/FormControl';
import { EmptyState } from '../../../components/feedback/EmptyState';
import type { CommissionRuleOverride } from '../../../domain/commission/commissionRuleOverride';
import {
  calculateAmountFromShare,
  COMMISSION_SHARE_DEFAULT,
  isValidCommissionSharePercent,
} from '../../../domain/commission/commissionShare';
import type {
  AssignmentRuleView,
  RepresentativeAssignmentRow,
} from '../../../services/commissionAdminService';
import { useServices } from '../../../hooks/useServices';
import { useAdminContext } from '../AdminLayout';
import styles from '../AdminLayout.module.css';
import { AdminCommissionLayout } from './AdminCommissionLayout';

export function AdminCommissionAssignmentsPage() {
  const context = useAdminContext();
  const { commissionAdminService } = useServices();
  const [rows, setRows] = useState<RepresentativeAssignmentRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [model, setModel] = useState<'classic' | 'variable'>('classic');
  const [validFrom, setValidFrom] = useState('2026-01-01');
  const [validUntil, setValidUntil] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [ruleViews, setRuleViews] = useState<AssignmentRuleView[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!context) return;
    await commissionAdminService.ensureDefaultAssignments(context);
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
    void commissionAdminService
      .getAssignmentDetail(context, selectedUserId, { model })
      .then((detail) => {
        if ('error' in detail) return;
        setRuleViews(detail.ruleViews);
        setReason(detail.assignment?.reason ?? '');
        setNote(detail.currentVersion?.changeNote ?? '');
        setEditMode(detail.ruleViews.some((view) => view.isIndividual));
        if (detail.assignment) {
          setValidFrom(detail.assignment.validFrom.slice(0, 10));
          setValidUntil(detail.assignment.validUntil?.slice(0, 10) ?? '');
        }
      });
  }, [commissionAdminService, context, selectedUserId, model]);

  const toOverrides = (): CommissionRuleOverride[] =>
    ruleViews.map((view) => ({
      ruleId: view.ruleId,
      sharePercent: view.sharePercent,
      fixedAmountCents: null,
      percentTenthsOfBasisPoint: null,
    }));

  const handleSave = async () => {
    if (!context || !selectedUserId) return;
    for (const view of ruleViews) {
      if (!isValidCommissionSharePercent(view.sharePercent)) {
        setMessage('Fehler: share_range (0–100 %, ganzzahlig)');
        return;
      }
    }
    const result = await commissionAdminService.saveAssignment(context, {
      salesRepresentativeId: selectedUserId,
      model,
      validFrom,
      validUntil: validUntil || null,
      ruleOverrides: toOverrides(),
      changeNote: [reason.trim() || 'Individuelle Vereinbarung', note.trim()]
        .filter(Boolean)
        .join(' – '),
    });
    setMessage(result.ok ? 'Vereinbarung gespeichert' : `Fehler: ${result.error}`);
    await load();
  };

  const handleReset = async () => {
    if (!context || !selectedUserId) return;
    const result = await commissionAdminService.resetAssignmentOverrides(context, selectedUserId);
    setMessage(result.ok ? 'Auf 100 % Standard zurückgesetzt' : `Fehler: ${result.error}`);
    if (result.ok) {
      setEditMode(false);
      setRuleViews((current) =>
        current.map((view) => ({
          ...view,
          sharePercent: COMMISSION_SHARE_DEFAULT,
          calculatedAmountCents: calculateAmountFromShare(
            view.standardAmountCents,
            COMMISSION_SHARE_DEFAULT,
          ),
          calculatedLabel: view.standardLabel,
          isIndividual: false,
        })),
      );
    }
    await load();
  };

  const allStandard = ruleViews.every((view) => !view.isIndividual);

  return (
    <AdminCommissionLayout title="Provision – Mitarbeiter & Vereinbarungen">
      <section className={styles.panel}>
        <h2>Außendienst</h2>
        <p>
          Ohne Pflege gilt automatisch 100&nbsp;% des aktuellen Standardmodells. Eine Eingabe ist
          nur nötig, wenn eine individuelle Vereinbarung besteht.
        </p>
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
                <th>Kennzeichnung</th>
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
                  <td>{row.hasIndividualOverrides ? 'Individuell' : 'Standard (100 %)'}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId(row.userId);
                        setModel(row.model ?? 'classic');
                      }}
                    >
                      Anzeigen
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
          <h2>Mitarbeiterwerte</h2>
          <p role="status">
            {allStandard
              ? 'Aktuell: Standard (100 %) – keine Eingabe erforderlich.'
              : 'Aktuell: individuelle Vereinbarung (Prozent führt).'}
          </p>
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
            <FormControl
              type="date"
              label="Gültig ab"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
            <FormControl
              type="date"
              label="Gültig bis"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
            <FormControl
              type="text"
              label="Grund"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <FormControl
              type="text"
              label="Notiz"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Regel</th>
                <th>Standardbetrag</th>
                <th>Mitarbeiter %</th>
                <th>Berechneter Eurobetrag</th>
                <th>Kennzeichnung</th>
              </tr>
            </thead>
            <tbody>
              {ruleViews.map((view) => (
                <tr key={view.ruleId}>
                  <td>{view.ruleName}</td>
                  <td>{view.standardLabel}</td>
                  <td>
                    {editMode ? (
                      <FormControl
                        type="text"
                        label={`${view.ruleName} %`}
                        value={String(view.sharePercent)}
                        onChange={(event) => {
                          const value = Number(event.target.value.replace(',', '.'));
                          setRuleViews((current) =>
                            current.map((entry) => {
                              if (entry.ruleId !== view.ruleId) {
                                return entry;
                              }
                              const share = Number.isFinite(value)
                                ? Math.round(value)
                                : entry.sharePercent;
                              const calculated = calculateAmountFromShare(
                                entry.standardAmountCents,
                                share,
                              );
                              return {
                                ...entry,
                                sharePercent: share,
                                calculatedAmountCents: calculated,
                                calculatedLabel:
                                  calculated != null
                                    ? `${(calculated / 100).toFixed(2)} €`
                                    : entry.calculatedLabel,
                                isIndividual: share !== COMMISSION_SHARE_DEFAULT,
                              };
                            }),
                          );
                        }}
                      />
                    ) : (
                      `${view.sharePercent} %`
                    )}
                  </td>
                  <td>{view.calculatedLabel}</td>
                  <td>{view.isIndividual ? 'Individuell' : 'Standard'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.toolbar}>
            {!editMode ? (
              <button type="button" onClick={() => setEditMode(true)}>
                Individuelle Anteile bearbeiten
              </button>
            ) : (
              <button type="button" onClick={() => void handleSave()}>
                Speichern
              </button>
            )}
            <button type="button" onClick={() => void handleReset()}>
              Auf Standard (100 %) zurücksetzen
            </button>
          </div>
          {message ? <p role="status">{message}</p> : null}
        </section>
      ) : null}
    </AdminCommissionLayout>
  );
}
