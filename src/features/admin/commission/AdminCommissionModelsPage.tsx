import { useEffect, useState } from 'react';
import { FormControl } from '../../../components/common/FormControl';
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
    let catalog = await commissionCatalogAdminService.getCatalog(context);
    if ('error' in catalog) return;
    if (catalog.commissionRules.length === 0) {
      await commissionCatalogAdminService.seedDefaultCatalog(context);
      catalog = await commissionCatalogAdminService.getCatalog(context);
      if ('error' in catalog) return;
      setMessage('Standardkatalog automatisch aktiviert');
    }
    setRules(catalog.commissionRules);
    const next: Record<string, RuleDraft> = {};
    for (const rule of catalog.commissionRules) {
      next[rule.id] = toDraft(rule);
    }
    setDrafts(next);
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
    const fixedAmountCents = draft.fixedAmountEuro
      ? Math.round(Number(draft.fixedAmountEuro.replace(',', '.')) * 100)
      : null;
    const percentTenthsOfBasisPoint = draft.percentOfBasis
      ? Math.round(Number(draft.percentOfBasis.replace(',', '.')) * 100)
      : null;

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
    setMessage(result.ok ? `Standardregel „${draft.name}“ gespeichert` : `Fehler: ${result.error}`);
    await load();
  };

  const classicRules = rules.filter(
    (rule) => rule.commissionPlanVersionId === DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
  );
  const variableRules = rules.filter(
    (rule) => rule.commissionPlanVersionId === DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
  );

  const renderRuleTable = (title: string, sectionRules: CommissionRule[]) => (
    <section className={styles.panel}>
      <h2>{title}</h2>
      {sectionRules.length === 0 ? (
        <EmptyState title="Keine Regeln" description="Bitte Standardkatalog aktivieren." />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Beschreibung</th>
              <th>Standardbetrag</th>
              <th>Prozentsatz</th>
              <th>Berechnet</th>
              <th>Aktiv</th>
              <th>Gültig ab</th>
              <th>Gültig bis</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sectionRules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>{rule.internalDescription || rule.name}</td>
                <td>{standardAmountLabel(rule)}</td>
                <td>{formatSharePercent(COMMISSION_SHARE_DEFAULT)}</td>
                <td>{calculatedAmountLabel(rule)}</td>
                <td>{rule.status === 'active' ? 'Ja' : 'Nein'}</td>
                <td>{rule.validFrom?.slice(0, 10) || 'offen'}</td>
                <td>{rule.validUntil?.slice(0, 10) || 'unbefristet'}</td>
                <td>
                  <button type="button" onClick={() => setSelectedId(rule.id)}>
                    Bearbeiten
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
