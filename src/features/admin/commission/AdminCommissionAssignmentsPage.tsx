import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Dialog } from '../../../v2/ui/Dialog';

export function CommissionAssignmentsPanel() {
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
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const saveInFlightRef = useRef(false);

  const selectedRow = selectedUserId ? rows.find((row) => row.userId === selectedUserId) : null;

  const load = useCallback(async () => {
    if (!context) return;
    try {
      let result = await commissionAdminService.listRepresentativeAssignments(context);
      if (Array.isArray(result)) {
        const needsDefaults = result.some((row) => row.status === 'active' && !row.assignmentId);
        if (needsDefaults) {
          await commissionAdminService.ensureDefaultAssignments(context);
          result = await commissionAdminService.listRepresentativeAssignments(context);
        }
      }
      if (Array.isArray(result)) {
        setRows(result);
      } else {
        setMessage(commissionErrorLabel(result.error));
      }
    } catch (error) {
      setMessage(`Fehler: ${formatPersistError(error)}`);
    }
  }, [commissionAdminService, context]);

  const refreshRows = useCallback(async () => {
    if (!context) return;
    try {
      const result = await commissionAdminService.listRepresentativeAssignments(context);
      if (Array.isArray(result)) {
        setRows(result);
      }
    } catch (error) {
      setMessage(`Fehler: ${formatPersistError(error)}`);
    }
  }, [commissionAdminService, context]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!context || !selectedUserId) return;
    setIsDetailLoading(true);
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
      })
      .finally(() => {
        setIsDetailLoading(false);
      });
  }, [commissionAdminService, context, selectedUserId, model]);

  const closeDialog = () => {
    setSelectedUserId(null);
  };

  const openDialog = (row: RepresentativeAssignmentRow) => {
    if (!context) {
      return;
    }
    setSelectedUserId(row.userId);
    setModel(row.model ?? 'classic');
    setMessage(null);
    setRuleViews([]);
  };

  const toOverrides = (): CommissionRuleOverride[] =>
    ruleViews.map((view) => ({
      ruleId: view.ruleId,
      sharePercent: view.sharePercent,
      fixedAmountCents: null,
      percentTenthsOfBasisPoint: null,
    }));

  const handleSave = useCallback(async () => {
    if (!context || !selectedUserId || saveInFlightRef.current) {
      return;
    }
    for (const view of ruleViews) {
      if (!isValidCommissionSharePercent(view.sharePercent)) {
        setMessage(`Fehler: ${commissionErrorLabel('share_range')}`);
        return;
      }
    }
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const payload = {
        salesRepresentativeId: selectedUserId,
        model,
        validFrom,
        validUntil: validUntil || null,
        ruleOverrides: toOverrides(),
        changeNote: [reason.trim() || 'Individuelle Vereinbarung', note.trim()]
          .filter(Boolean)
          .join(' – '),
      };
      let result = await commissionAdminService.saveAssignment(context, payload);
      if (
        !result.ok &&
        result.error !== 'share_range' &&
        result.error !== 'overlap' &&
        result.error !== 'forbidden'
      ) {
        result = await commissionAdminService.saveAssignment(context, payload);
      }
      if (result.ok) {
        closeDialog();
        setMessage('Vereinbarung gespeichert');
        void refreshRows();
      } else {
        setMessage(`Fehler: ${commissionErrorLabel(result.error)}`);
      }
    } catch (error) {
      setMessage(`Fehler: ${formatPersistError(error)}`);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [
    commissionAdminService,
    context,
    load,
    refreshRows,
    model,
    note,
    reason,
    ruleViews,
    selectedUserId,
    validFrom,
    validUntil,
  ]);

  const handleReset = useCallback(async () => {
    if (!context || !selectedUserId || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const result = await commissionAdminService.resetAssignmentOverrides(context, selectedUserId);
      if (result.ok) {
        closeDialog();
        setMessage('Auf 100 % Standard zurückgesetzt');
        void refreshRows();
      } else {
        setMessage(`Fehler: ${commissionErrorLabel(result.error)}`);
      }
    } catch (error) {
      setMessage(`Fehler: ${formatPersistError(error)}`);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [commissionAdminService, context, refreshRows, selectedUserId]);

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

  return (
    <>
      <section className={styles.panel}>
        <h2>Außendienst</h2>
        <p>
          Ohne Pflege gilt automatisch 100&nbsp;% des aktuellen Standardmodells. Eine Eingabe ist
          nur nötig, wenn eine individuelle Vereinbarung besteht.
        </p>
        {message && !selectedUserId ? <p role="status">{message}</p> : null}
        <ResponsiveTable
          columns={representativeColumns}
          rows={rows}
          rowKey={(row) => row.userId}
          emptyState={
            <EmptyState title="Keine Mitarbeiter" description="Keine Außendienstmitarbeiter gefunden." />
          }
          renderActions={(row) => (
            <button type="button" onClick={() => openDialog(row)}>
              Bearbeiten
            </button>
          )}
          tableClassName={styles.table}
        />
      </section>

      <Dialog
        isOpen={Boolean(selectedUserId && selectedRow)}
        title={
          selectedRow
            ? `Vereinbarung – ${selectedRow.name}`
            : 'Mitarbeitervereinbarung bearbeiten'
        }
        onClose={closeDialog}
        secondaryAction={{ label: 'Abbrechen', onClick: closeDialog, disabled: saving }}
        primaryAction={{
          label: 'Speichern',
          onClick: () => void handleSave(),
          loading: saving,
          disabled: saving || isDetailLoading,
        }}
      >
        {selectedRow ? (
          <>
            <p>
              {selectedRow.email} ·{' '}
              {isDetailLoading
                ? 'Vereinbarung wird geladen…'
                : allStandard
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

            {isDetailLoading ? (
              <EmptyState title="Vereinbarung wird geladen" description="Regeln werden vorbereitet." />
            ) : (
              <ResponsiveTable
                columns={[
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
                ]}
                rows={ruleViews}
                rowKey={(view) => view.ruleId}
                mobileMode="scroll"
                tableClassName={styles.table}
              />
            )}

            <div className={styles.toolbar}>
              <button type="button" disabled={saving || isDetailLoading} onClick={() => void handleReset()}>
                Auf Standard (100 %) zurücksetzen
              </button>
            </div>
            {message ? <p role="alert">{message}</p> : null}
          </>
        ) : null}
      </Dialog>
    </>
  );
}

export function AdminCommissionAssignmentsPage() {
  return (
    <AdminCommissionLayout title="Provision – Mitarbeiter & Vereinbarungen">
      <CommissionAssignmentsPanel />
    </AdminCommissionLayout>
  );
}
