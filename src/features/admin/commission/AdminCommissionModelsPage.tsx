import { useEffect, useMemo, useState } from 'react';
import { FormControl } from '../../../components/common/FormControl';
import { ResponsiveTable } from '../../../components/common/ResponsiveTable';
import { EmptyState } from '../../../components/feedback/EmptyState';
import type { CommissionRule } from '../../../domain/commission/commissionRule';
import {
  calculateAmountFromShare,
  COMMISSION_SHARE_DEFAULT,
  formatEuroCents,
  formatSharePercent,
} from '../../../domain/commission/commissionShare';
import {
  DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
  DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
} from '../../../services/commissionCatalogSeed';
import { useServices } from '../../../hooks/useServices';
import { useAdminContext } from '../AdminLayout';
import styles from '../AdminLayout.module.css';
import { AdminCommissionLayout } from './AdminCommissionLayout';
import { commissionErrorLabel } from './commissionErrorLabel';
import { formatPersistError } from '../../../utils/persistError';

interface RuleDraft {
  id: string;
  name: string;
  internalDescription: string;
  status: 'active' | 'inactive';
  fixedAmountEuro: string;
  displaySharePercent: string;
  percentOfBasis: string;
  validFrom: string;
  validUntil: string;
  commissionPlanVersionId: string;
  commissionType: CommissionRule['commissionType'];
  calculationBasis: CommissionRule['calculationBasis'];
  contractTypeCode: string;
}

function standardAmountLabel(rule: CommissionRule): string {
  if (rule.fixedAmountCents != null) {
    return formatEuroCents(rule.fixedAmountCents);
  }
  if (rule.percentTenthsOfBasisPoint != null) {
    return `${rule.percentTenthsOfBasisPoint / 100} % der Basis`;
  }
  return 'nicht gesetzt';
}

function calculatedAmountLabel(rule: CommissionRule, sharePercent = COMMISSION_SHARE_DEFAULT): string {
  if (rule.fixedAmountCents != null) {
    return formatEuroCents(calculateAmountFromShare(rule.fixedAmountCents, sharePercent));
  }
  if (rule.percentTenthsOfBasisPoint != null) {
    return `${((rule.percentTenthsOfBasisPoint / 100) * sharePercent) / 100} % der Basis`;
  }
  return 'nicht gesetzt';
}

function toDraft(rule: CommissionRule): RuleDraft {
  return {
    id: rule.id,
    name: rule.name,
    internalDescription: rule.internalDescription,
    status: rule.status === 'inactive' ? 'inactive' : 'active',
    fixedAmountEuro:
      rule.fixedAmountCents != null ? String(rule.fixedAmountCents / 100) : '',
    displaySharePercent: String(COMMISSION_SHARE_DEFAULT),
    percentOfBasis:
      rule.percentTenthsOfBasisPoint != null
        ? String(rule.percentTenthsOfBasisPoint / 100)
        : '',
    validFrom: rule.validFrom?.slice(0, 10) ?? '',
    validUntil: rule.validUntil?.slice(0, 10) ?? '',
    commissionPlanVersionId: rule.commissionPlanVersionId,
    commissionType: rule.commissionType,
    calculationBasis: rule.calculationBasis,
    contractTypeCode: rule.contractTypeCode ?? '',
  };
}

export function AdminCommissionModelsPage() {
  const context = useAdminContext();
  const { commissionCatalogAdminService } = useServices();
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RuleDraft>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!context) return;
    try {
      let catalog = await commissionCatalogAdminService.getCatalog(context);
      if ('error' in catalog) {
        setMessage(commissionErrorLabel(catalog.error));
        return;
      }
      if (catalog.commissionRules.length === 0) {
        await commissionCatalogAdminService.seedDefaultCatalog(context);
        catalog = await commissionCatalogAdminService.getCatalog(context);
        if ('error' in catalog) {
          setMessage(commissionErrorLabel(catalog.error));
          return;
        }
        setMessage('Standardkatalog automatisch aktiviert');
      }
      setRules(catalog.commissionRules);
      const next: Record<string, RuleDraft> = {};
      for (const rule of catalog.commissionRules) {
        next[rule.id] = toDraft(rule);
      }
      setDrafts(next);
    } catch (error) {
      setMessage(`Fehler: ${formatPersistError(error)}`);
    }
  };

  useEffect(() => {
    void load();
  }, [commissionCatalogAdminService, context]);

  const handleSeed = async () => {
    if (!context) return;
    const result = await commissionCatalogAdminService.seedDefaultCatalog(context);
    setMessage(result.ok ? 'Standardkatalog aktiviert / ergänzt' : result.error);
    await load();
  };

  const handleSave = async (ruleId: string) => {
    if (!context) return;
    const draft = drafts[ruleId];
    if (!draft) return;
    const share = Number(draft.displaySharePercent);
    const fixedAmountCents = draft.fixedAmountEuro.trim()
      ? Math.round(Number(draft.fixedAmountEuro.replace(',', '.')) * 100)
      : null;
    const percentTenthsOfBasisPoint = draft.percentOfBasis.trim()
      ? Math.round(Number(draft.percentOfBasis.replace(',', '.')) * 100)
      : null;

    try {
      const result = await commissionCatalogAdminService.upsertStandardRule(context, {
        id: draft.id,
        commissionPlanVersionId: draft.commissionPlanVersionId,
        name: draft.name,
        internalDescription: draft.internalDescription,
        status: draft.status,
        commissionType: draft.commissionType,
        calculationBasis: draft.calculationBasis,
        contractTypeCode: draft.contractTypeCode || null,
        fixedAmountCents,
        percentTenthsOfBasisPoint,
        displaySharePercent: share,
        validFrom: draft.validFrom || null,
        validUntil: draft.validUntil || null,
      });
      if (result.ok) {
        setMessage(`Standardregel „${draft.name}“ gespeichert`);
        setSelectedId(null);
      } else {
        setMessage(`Fehler: ${commissionErrorLabel(result.error)}`);
      }
      await load();
    } catch (error) {
      setMessage(`Fehler: ${formatPersistError(error)}`);
    }
  };

  const ruleColumns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Name',
        render: (rule: CommissionRule) => rule.name,
      },
      {
        id: 'description',
        header: 'Beschreibung',
        render: (rule: CommissionRule) => rule.internalDescription || rule.name,
      },
      {
        id: 'amount',
        header: 'Standardbetrag',
        render: (rule: CommissionRule) => standardAmountLabel(rule),
      },
      {
        id: 'share',
        header: 'Prozentsatz',
        render: () => formatSharePercent(COMMISSION_SHARE_DEFAULT),
      },
      {
        id: 'calculated',
        header: 'Berechnet',
        render: (rule: CommissionRule) => calculatedAmountLabel(rule),
      },
      {
        id: 'active',
        header: 'Aktiv',
        render: (rule: CommissionRule) => (rule.status === 'active' ? 'Ja' : 'Nein'),
      },
      {
        id: 'validFrom',
        header: 'Gültig ab',
        render: (rule: CommissionRule) => rule.validFrom?.slice(0, 10) || 'offen',
      },
      {
        id: 'validUntil',
        header: 'Gültig bis',
        render: (rule: CommissionRule) => rule.validUntil?.slice(0, 10) || 'unbefristet',
      },
    ],
    [],
  );

  const classicRules = rules.filter(
    (rule) => rule.commissionPlanVersionId === DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
  );
  const variableRules = rules.filter(
    (rule) => rule.commissionPlanVersionId === DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
  );

  const renderRuleTable = (title: string, sectionRules: CommissionRule[]) => (
    <section className={styles.panel}>
      <h2>{title}</h2>
      <ResponsiveTable
        columns={ruleColumns}
        rows={sectionRules}
        rowKey={(rule) => rule.id}
        emptyState={
          <EmptyState title="Keine Regeln" description="Bitte Standardkatalog aktivieren." />
        }
        renderActions={(rule) => (
          <button type="button" onClick={() => setSelectedId(rule.id)}>
            Bearbeiten
          </button>
        )}
        tableClassName={styles.table}
      />
    </section>
  );

  const selected = selectedId ? drafts[selectedId] : null;
  const selectedRule = selectedId ? rules.find((rule) => rule.id === selectedId) : null;

  return (
    <AdminCommissionLayout
      title="Provision – Standardprovisionen"
      actions={
        <button type="button" onClick={() => void handleSeed()}>
          Standardkatalog ergänzen
        </button>
      }
    >
      {message ? <p role="status">{message}</p> : null}
      <p>
        Unternehmensweite Standardprovisionen. Alle Außendienstmitarbeiter erhalten standardmäßig
        100&nbsp;% dieser Werte. Individuelle Vereinbarungen überschreiben nur einzelne Regeln.
      </p>
      {renderRuleTable('CLASSIC', classicRules)}
      {renderRuleTable('VARIABLE', variableRules)}

      {selected && selectedRule ? (
        <section className={styles.panel}>
          <h2>Regel bearbeiten</h2>
          <div className={styles.formGrid}>
            <FormControl
              type="text"
              label="Name"
              value={selected.name}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [selected.id]: { ...selected, name: event.target.value },
                }))
              }
            />
            <FormControl
              type="text"
              label="Beschreibung"
              value={selected.internalDescription}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [selected.id]: { ...selected, internalDescription: event.target.value },
                }))
              }
            />
            <FormControl
              type="text"
              label="Standardbetrag (EUR)"
              value={selected.fixedAmountEuro}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [selected.id]: { ...selected, fixedAmountEuro: event.target.value },
                }))
              }
            />
            <FormControl
              type="text"
              label="Prozentsatz (Anzeige 0–100)"
              value={selected.displaySharePercent}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [selected.id]: { ...selected, displaySharePercent: event.target.value },
                }))
              }
            />
            <FormControl
              type="text"
              label="Berechneter Betrag"
              value={calculatedAmountLabel(
                {
                  ...selectedRule,
                  fixedAmountCents: selected.fixedAmountEuro
                    ? Math.round(Number(selected.fixedAmountEuro.replace(',', '.')) * 100)
                    : null,
                  percentTenthsOfBasisPoint: selected.percentOfBasis
                    ? Math.round(Number(selected.percentOfBasis.replace(',', '.')) * 100)
                    : null,
                },
                Number(selected.displaySharePercent) || COMMISSION_SHARE_DEFAULT,
              )}
              onChange={() => undefined}
              disabled
            />
            <FormControl
              type="text"
              label="Variabler %-Satz der Basis"
              value={selected.percentOfBasis}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [selected.id]: { ...selected, percentOfBasis: event.target.value },
                }))
              }
            />
            <FormControl
              type="select"
              label="Aktiv"
              value={selected.status}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [selected.id]: {
                    ...selected,
                    status: event.target.value as 'active' | 'inactive',
                  },
                }))
              }
              options={[
                { value: 'active', label: 'Aktiv' },
                { value: 'inactive', label: 'Inaktiv' },
              ]}
            />
            <FormControl
              type="date"
              label="Gültig ab"
              value={selected.validFrom}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [selected.id]: { ...selected, validFrom: event.target.value },
                }))
              }
            />
            <FormControl
              type="date"
              label="Gültig bis"
              value={selected.validUntil}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [selected.id]: { ...selected, validUntil: event.target.value },
                }))
              }
            />
          </div>
          <div className={styles.toolbar}>
            <button type="button" onClick={() => void handleSave(selected.id)}>
              Speichern
            </button>
            <button type="button" onClick={() => setSelectedId(null)}>
              Schließen
            </button>
          </div>
        </section>
      ) : null}
    </AdminCommissionLayout>
  );
}
