import { useEffect, useMemo, useState } from 'react';
import { FormControl } from '../../../components/common/FormControl';
import { ResponsiveTable } from '../../../components/common/ResponsiveTable';
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
import { commissionErrorLabel } from './commissionErrorLabel';
import { formatPersistError } from '../../../utils/persistError';

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
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!context) return;
    try {
      await commissionAdminService.ensureDefaultAssignments(context);
      const result = await commissionAdminService.listRepresentativeAssignments(context);
      if (Array.isArray(result)) {
        setRows(result);
      } else {
        setMessage(commissionErrorLabel(result.error));
      }
    } catch (error) {
      setMessage(`Fehler: ${formatPersistError(error)}`);
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
        if ('error' in detail) {
          setMessage(commissionErrorLabel(detail.error));
          return;
        }
        setRuleViews(detail.ruleViews);
        setReason(detail.assignment?.reason ?? '');
        setNote(detail.currentVersion?.changeNote ?? '');
        if (detail.assignment) {
          setValidFrom(detail.assignment.validFrom.slice(0, 10));
          setValidUntil(detail.assignment.validUntil?.slice(0, 10) ?? '');
        }
      })
      .catch((error: unknown) => {
        setMessage(`Fehler: ${formatPersistError(error)}`);
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
        setMessage(`Fehler: ${commissionErrorLabel('share_range')}`);
        return;
      }
    }
    setSaving(true);
    try {
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
      setMessage(
        result.ok ? 'Vereinbarung gespeichert' : `Fehler: ${commissionErrorLabel(result.error)}`,
      );
      await load();
      if (result.ok && selectedUserId) {
        const detail = await commissionAdminService.getAssignmentDetail(context, selectedUserId, {
          model,
        });
        if (!('error' in detail)) {
          setRuleViews(detail.ruleViews);
        }
      }
    } catch (error) {
      setMessage(`Fehler: ${formatPersistError(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!context || !selectedUserId) return;
    setSaving(true);
    try {
      const result = await commissionAdminService.resetAssignmentOverrides(context, selectedUserId);
      setMessage(
        result.ok
          ? 'Auf 100 % Standard zurückgesetzt'
          : `Fehler: ${commissionErrorLabel(result.error)}`,
      );
      if (result.ok) {
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
    } catch (error) {
      setMessage(`Fehler: ${formatPersistError(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const updateSharePercent = (ruleId: string, rawValue: string) => {
    const value = Number(rawValue.replace(',', '.'));
    setRuleViews((current) =>
      current.map((entry) => {
        if (entry.ruleId !== ruleId) {
          return entry;
        }
        const share = Number.isFinite(value) ? Math.round(value) : entry.sharePercent;
        const calculated = calculateAmountFromShare(entry.standardAmountCents, share);
        return {
          ...entry,
          sharePercent: share,
          calculatedAmountCents: calculated,
          calculatedLabel:
            calculated != null ? `${(calculated / 100).toFixed(2)} €` : entry.calculatedLabel,
          isIndividual: share !== COMMISSION_SHARE_DEFAULT,
        };
      }),
    );
  };

  const allStandard = ruleViews.every((view) => !view.isIndividual);

  const representativeColumns = useMemo(
    () => [
      { id: 'name', header: 'Name', render: (row: RepresentativeAssignmentRow) => row.name },
      { id: 'email', header: 'E-Mail', render: (row: RepresentativeAssignmentRow) => row.email },
      { id: 'status', header: 'Status', render: (row: RepresentativeAssignmentRow) => row.status },
      {
        id: 'model',
        header: 'Modell',
        render: (row: RepresentativeAssignmentRow) => row.modelLabel,
      },
      {
        id: 'validFrom',
        header: 'Gültig ab',
        render: (row: RepresentativeAssignmentRow) => row.validFrom ?? '—',
      },
      {
        id: 'validUntil',
        header: 'Gültig bis',
        render: (row: RepresentativeAssignmentRow) => row.validUntil ?? '—',
      },
      {
        id: 'label',
        header: 'Kennzeichnung',
        render: (row: RepresentativeAssignmentRow) =>
          row.hasIndividualOverrides ? 'Individuell' : 'Standard (100 %)',
      },
    ],
    [],
  );

  const ruleViewColumns = [
      {
        id: 'rule',
        header: 'Regel',
        render: (view: AssignmentRuleView) => view.ruleName,
      },
      {
        id: 'standard',
        header: 'Standardbetrag',
        render: (view: AssignmentRuleView) => view.standardLabel,
      },
      {
        id: 'share',
        header: 'Mitarbeiter %',
        render: (view: AssignmentRuleView) => (
          <FormControl
            type="text"
            label={`${view.ruleName} %`}
            value={String(view.sharePercent)}
            onChange={(event) => updateSharePercent(view.ruleId, event.target.value)}
          />
        ),
      },
      {
        id: 'calculated',
        header: 'Berechneter Eurobetrag',
        render: (view: AssignmentRuleView) => view.calculatedLabel,
      },
      {
        id: 'label',
        header: 'Kennzeichnung',
        render: (view: AssignmentRuleView) => (view.isIndividual ? 'Individuell' : 'Standard'),
      },
  ];

  return (
    <AdminCommissionLayout title="Provision – Mitarbeiter & Vereinbarungen">
      <section className={styles.panel}>
        <h2>Außendienst</h2>
        <p>
          Ohne Pflege gilt automatisch 100&nbsp;% des aktuellen Standardmodells. Eine Eingabe ist
          nur nötig, wenn eine individuelle Vereinbarung besteht.
        </p>
        <ResponsiveTable
          columns={representativeColumns}
          rows={rows}
          rowKey={(row) => row.userId}
          emptyState={
            <EmptyState title="Keine Mitarbeiter" description="Keine Außendienstmitarbeiter gefunden." />
          }
          renderActions={(row) => (
            <button
              type="button"
              onClick={() => {
                setSelectedUserId(row.userId);
                setModel(row.model ?? 'classic');
                setMessage(null);
              }}
            >
              Anzeigen
            </button>
          )}
          tableClassName={styles.table}
        />
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

          <ResponsiveTable
            columns={ruleViewColumns}
            rows={ruleViews}
            rowKey={(view) => view.ruleId}
            tableClassName={styles.table}
          />

          <div className={styles.toolbar}>
            <button type="button" disabled={saving} onClick={() => void handleSave()}>
              Speichern
            </button>
            <button type="button" disabled={saving} onClick={() => void handleReset()}>
              Auf Standard (100 %) zurücksetzen
            </button>
          </div>
          {message ? <p role="status">{message}</p> : null}
        </section>
      ) : message ? (
        <p role="status">{message}</p>
      ) : null}
    </AdminCommissionLayout>
  );
}
