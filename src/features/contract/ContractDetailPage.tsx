import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import type { Contract } from '../../domain/contract/contract';
import type { ContractTermination } from '../../domain/contract/contractTermination';
import {
  CONTRACT_TERMINATION_REASON_LABELS,
  CONTRACT_TERMINATION_STATUS_LABELS,
  type ContractTerminationReason,
} from '../../domain/contract/contractTermination';
import type { ContractVersion, ContractVersionDiffEntry } from '../../domain/contract/contractVersion';
import {
  CONTRACT_CHANGE_REASON_LABELS,
  CONTRACT_VERSION_STATUS_LABELS,
  type ContractChangeReason,
} from '../../domain/contract/contractVersion';
import { OFFER_CONTRACT_MODEL_LABELS } from '../../domain/offer/offerContractModel';
import { hasPermission } from '../../domain/permission/permission';
import type { ActivationCase } from '../../domain/activation/activationCase';
import { ActivationStatusBadge } from '../activation/ActivationStatusBadge';
import type { SalesDocument } from '../../domain/salesDocument/salesDocument';
import { SALES_DOCUMENT_TYPE_LABELS } from '../../domain/salesDocument/salesDocument';
import type { SalesActivity } from '../../domain/salesWorkspace/salesActivity';
import { SALES_ACTIVITY_TYPE_LABELS } from '../../domain/salesWorkspace/salesActivity';
import type { SalesTask } from '../../domain/salesWorkspace/salesTask';
import { SALES_TASK_STATUS_LABELS, SALES_TASK_TYPE_LABELS } from '../../domain/salesWorkspace/salesTask';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { ContractStatusBadge } from './ContractStatusBadge';
import styles from './ContractDetailPage.module.css';

type TabId = 'overview' | 'versions' | 'changes' | 'termination' | 'documents' | 'tasks';

export function ContractDetailPage() {
  const { contractId = '' } = useParams();
  const { currentUser } = useCurrentUser();
  const { contractService, activationService, salesTaskService, salesActivityService } = useServices();
  const [contract, setContract] = useState<Contract | null>(null);
  const [activation, setActivation] = useState<ActivationCase | null>(null);
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [terminations, setTerminations] = useState<ContractTermination[]>([]);
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [tasks, setTasks] = useState<SalesTask[]>([]);
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [tab, setTab] = useState<TabId>('overview');
  const [error, setError] = useState<'forbidden' | 'not_found' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<ContractVersionDiffEntry[]>([]);
  const [changeReason, setChangeReason] = useState<ContractChangeReason>('fee_change');
  const [changeNote, setChangeNote] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [terminationReason, setTerminationReason] = useState<ContractTerminationReason>('price');
  const [terminationOther, setTerminationOther] = useState('');
  const [requestedEnd, setRequestedEnd] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null);
  const [confirmTitle, setConfirmTitle] = useState('');

  const context = currentUser
    ? {
        userId: currentUser.id,
        role: currentUser.role,
        displayName: currentUser.name,
        status: currentUser.status,
      }
    : null;

  const reload = async () => {
    if (!context || !contractId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const result = await contractService.getById(contractId, context);
    if (!result.ok) {
      setError(result.error === 'forbidden' ? 'forbidden' : 'not_found');
      setIsLoading(false);
      return;
    }
    setContract(result.value);
    setError(null);
    const [versionResult, terminationResult, documentResult, taskList, activityList, activationCase] =
      await Promise.all([
        contractService.listVersions(contractId, context),
        contractService.listTerminations(contractId, context),
        contractService.listDocuments(contractId, context),
        salesTaskService.listVisible(context),
        salesActivityService.listVisible(context),
        activationService.getByContractId(contractId, context),
      ]);
    if (versionResult.ok) setVersions(versionResult.value);
    if (terminationResult.ok) setTerminations(terminationResult.value);
    if (documentResult.ok) setDocuments(documentResult.value);
    setTasks(taskList.filter((task) => task.contractId === contractId));
    setActivities(activityList.filter((activity) => activity.contractId === contractId));
    setActivation(activationCase);
    setIsLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, currentUser?.id]);

  if (!currentUser || !context) return null;
  if (isLoading && !contract) {
    return (
      <section>
        <PageHeader title="Vertrag" subtitle="Daten werden geladen…" />
        <EmptyState title="Vertrag wird geladen" description="Die Vertragsdetails werden abgerufen." />
      </section>
    );
  }
  if (error === 'forbidden') return <AccessDenied title="Kein Zugriff auf diesen Vertrag" />;
  if (error === 'not_found' || !contract) {
    return <EmptyState title="Vertrag nicht gefunden" description="Die Referenz ist ungültig oder fehlt." />;
  }

  const currentVersion = versions.find((version) => version.id === contract.currentVersionId) ?? null;
  const planned = versions.filter((version) => version.status === 'draft' || version.status === 'planned');
  const openTermination = terminations.find(
    (entry) => !['withdrawn', 'completed', 'rejected'].includes(entry.status),
  );
  const nextTask =
    tasks.find((task) => task.status === 'open' || task.status === 'in_progress') ?? null;

  const askConfirm = (title: string, action: () => Promise<void>) => {
    setConfirmTitle(title);
    setConfirmAction(() => action);
  };

  const startChange = async () => {
    const result = await contractService.startChange(
      contract.id,
      {
        changeReason,
        changeNote,
        validFrom: validFrom || null,
        patch: {
          termMonths: termMonths ? Number(termMonths) : undefined,
          fees: monthlyFee
            ? {
                ...currentVersion!.snapshot.fees,
                monthlyFeeCents: Math.round(Number(monthlyFee) * 100),
              }
            : undefined,
          customerContactLastName: contactLastName || undefined,
        },
      },
      context,
    );
    setMessage(result.ok ? `Version ${result.value.versionNumber} erstellt` : result.message ?? result.error);
    await reload();
  };

  const recordTermination = async () => {
    const result = await contractService.recordTermination(
      contract.id,
      {
        reason: terminationReason,
        otherReasonText: terminationOther || null,
        requestedEndDate: requestedEnd || null,
      },
      context,
    );
    setMessage(result.ok ? 'Kündigung erfasst' : result.message ?? result.error);
    await reload();
  };

  return (
    <section>
      <PageHeader
        title={contract.contractNumber}
        subtitle={contract.customerCompanyName}
        actions={
          <div className={styles.actions}>
            <Link className={styles.linkButton} to="/contracts">Verträge</Link>
            {contract.leadId ? (
              <Link className={styles.linkButton} to={`/leads/${contract.leadId}`}>Lead</Link>
            ) : null}
            {contract.sourceOfferId ? (
              <Link className={styles.linkButton} to={`/offers/${contract.sourceOfferId}`}>
                Angebot
              </Link>
            ) : null}
          </div>
        }
      />

      <div className={styles.headerMeta}>
        <ContractStatusBadge status={contract.status} />
        <span>Version: {currentVersion?.versionNumber ?? '–'}</span>
        <span>
          {contract.startDate ?? '–'} – {contract.endDate ?? '–'}
        </span>
        <span>
          Nächste Frist: {contract.nextDeadlineLabel ?? '–'} {contract.nextDeadlineAt ?? ''}
        </span>
        <span>Eigentümer: {contract.createdByDisplayName}</span>
        <span>Nächste Aktion: {nextTask?.title ?? '–'}</span>
      </div>

      {message ? <p role="status">{message}</p> : null}

      <div className={styles.section}>
        <h2>Aktivierung</h2>
        {activation ? (
          <div className={styles.row}>
            <Link className={styles.linkButton} to={`/activations/${activation.id}`}>
              {activation.activationNumber} öffnen
            </Link>
            <ActivationStatusBadge status={activation.status} />
            <span>Fortschritt: {activation.progressPercent}%</span>
            <span>Nächster Schritt: {activation.nextStep ?? '–'}</span>
          </div>
        ) : hasPermission(currentUser.role, 'activations.create') &&
          ['preparation', 'activation'].includes(contract.status) ? (
          <button
            type="button"
            onClick={() =>
              askConfirm('Aktivierung starten?', async () => {
                const result = await activationService.startFromContract(contract.id, context);
                setMessage(result.ok ? `Aktivierung ${result.value.activationNumber} gestartet` : result.message ?? result.error);
                await reload();
              })
            }
          >
            Aktivierung starten
          </button>
        ) : (
          <p>Für diesen Vertrag liegt noch keine Aktivierung vor.</p>
        )}
      </div>

      <div className={styles.actions}>
        {hasPermission(currentUser.role, 'contracts.suspend') && contract.status === 'active' ? (
          <button
            type="button"
            onClick={() =>
              askConfirm('Vertrag sperren?', async () => {
                await contractService.transitionStatus(contract.id, 'suspended', context);
                await reload();
              })
            }
          >
            Sperren
          </button>
        ) : null}
        {hasPermission(currentUser.role, 'contracts.suspend') && contract.status === 'suspended' ? (
          <button
            type="button"
            onClick={() =>
              askConfirm('Vertrag reaktivieren?', async () => {
                await contractService.transitionStatus(contract.id, 'active', context);
                await reload();
              })
            }
          >
            Reaktivieren
          </button>
        ) : null}
        {hasPermission(currentUser.role, 'contracts.extend') ? (
          <button
            type="button"
            onClick={() =>
              void contractService.extendContract(contract.id, { additionalMonths: 12 }, context).then(async (result) => {
                setMessage(result.ok ? 'Verlängerung vorbereitet' : result.message ?? result.error);
                await reload();
              })
            }
          >
            Verlängerung vorbereiten
          </button>
        ) : null}
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Vertragsbereiche">
        {(
          [
            ['overview', 'Übersicht'],
            ['versions', 'Versionen'],
            ['changes', 'Änderungen'],
            ['termination', 'Kündigung'],
            ['documents', 'Dokumente'],
            ['tasks', 'Aufgaben'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && currentVersion ? (
        <div className={styles.section} role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
          <h2>Übersicht</h2>
          <div className={styles.grid}>
            <div className={styles.row}>
              <span className={styles.label}>Tarif</span>
              <span>{currentVersion.snapshot.tariffSnapshot?.name ?? '–'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Vertragsmodell</span>
              <span>{OFFER_CONTRACT_MODEL_LABELS[currentVersion.snapshot.contractModel]}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Laufzeit</span>
              <span>{currentVersion.snapshot.termMonths ?? '–'} Monate</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Monatliche Gebühren</span>
              <span>
                {currentVersion.snapshot.fees.monthlyFeeCents != null
                  ? `${(currentVersion.snapshot.fees.monthlyFeeCents / 100).toFixed(2)} €`
                  : '–'}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Hardware</span>
              <span>
                {currentVersion.snapshot.hardware
                  .map((line) => `${line.quantity}× ${line.model}`)
                  .join(', ') || '–'}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Zubehör</span>
              <span>
                {currentVersion.snapshot.accessoryLines
                  .map((line) => `${line.quantity}× ${line.name}`)
                  .join(', ') || '–'}
              </span>
            </div>
            {hasPermission(currentUser.role, 'contracts.provision') ? (
              <div className={styles.row}>
                <span className={styles.label}>Provision (intern)</span>
                <span>
                  {contract.expectedCommissionCents != null
                    ? `${(contract.expectedCommissionCents / 100).toFixed(2)} €`
                    : 'Keine Referenz'}
                </span>
              </div>
            ) : null}
            <div className={styles.row}>
              <span className={styles.label}>Quellangebot</span>
              <span>
                {contract.sourceOfferId ? (
                  <Link to={`/offers/${contract.sourceOfferId}`}>Angebot öffnen</Link>
                ) : (
                  '–'
                )}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'versions' ? (
        <div className={styles.section} role="tabpanel" id="panel-versions" aria-labelledby="tab-versions">
          <h2>Versionen</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Gültig ab/bis</th>
                  <th>Grund</th>
                  <th>Vergleich</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td>{version.versionNumber}</td>
                    <td>{CONTRACT_VERSION_STATUS_LABELS[version.status]}</td>
                    <td>
                      {version.validFrom ?? '–'} / {version.validTo ?? '–'}
                    </td>
                    <td>{CONTRACT_CHANGE_REASON_LABELS[version.changeReason]}</td>
                    <td>
                      {version.previousVersionId ? (
                        <button
                          type="button"
                          onClick={() =>
                            void contractService
                              .getVersionDiff(version.previousVersionId!, version.id, context)
                              .then((result) => {
                                if (result.ok) setDiffs(result.value);
                              })
                          }
                        >
                          Diff
                        </button>
                      ) : (
                        '–'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {diffs.length > 0 ? (
            <ul className={styles.diffList}>
              {diffs.map((diff) => (
                <li key={diff.field}>
                  {diff.label}: {diff.before} → {diff.after}
                  {diff.approvalRelevant ? ' (freigaberelevant)' : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {tab === 'changes' ? (
        <div className={styles.section} role="tabpanel" id="panel-changes" aria-labelledby="tab-changes">
          <h2>Vertragsänderung</h2>
          {hasPermission(currentUser.role, 'contracts.change') ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                void startChange();
              }}
            >
              <label>
                Änderungsart
                <select
                  value={changeReason}
                  onChange={(event) => setChangeReason(event.target.value as ContractChangeReason)}
                >
                  {Object.entries(CONTRACT_CHANGE_REASON_LABELS)
                    .filter(([key]) => key !== 'initial')
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Notiz
                <input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} />
              </label>
              <label>
                Gültig ab (optional)
                <input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
              </label>
              <label>
                Neue Laufzeit (Monate)
                <input value={termMonths} onChange={(event) => setTermMonths(event.target.value)} />
              </label>
              <label>
                Monatliche Gebühr (€)
                <input value={monthlyFee} onChange={(event) => setMonthlyFee(event.target.value)} />
              </label>
              <label>
                Nachname Ansprechpartner
                <input
                  value={contactLastName}
                  onChange={(event) => setContactLastName(event.target.value)}
                />
              </label>
              <button type="submit">Änderung starten</button>
            </form>
          ) : null}
          {planned.map((version) => (
            <div key={version.id} className={styles.row}>
              <span>
                Geplant V{version.versionNumber} ab {version.validFrom} (
                {version.approvalRequired ? 'Freigabe nötig' : 'ohne Freigabe'})
              </span>
              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() =>
                    askConfirm('Version aktivieren?', async () => {
                      const result = await contractService.activateVersion(
                        contract.id,
                        version.id,
                        context,
                      );
                      setMessage(result.ok ? 'Version aktiviert' : result.message ?? result.error);
                      await reload();
                    })
                  }
                >
                  Aktivieren
                </button>
                <button
                  type="button"
                  onClick={() =>
                    askConfirm('Version verwerfen?', async () => {
                      await contractService.discardVersion(contract.id, version.id, context);
                      await reload();
                    })
                  }
                >
                  Verwerfen
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'termination' ? (
        <div className={styles.section} role="tabpanel" id="panel-termination" aria-labelledby="tab-termination">
          <h2>Kündigung</h2>
          {openTermination ? (
            <>
              <p>
                Status: {CONTRACT_TERMINATION_STATUS_LABELS[openTermination.status]} · Grund:{' '}
                {CONTRACT_TERMINATION_REASON_LABELS[openTermination.reason]}
              </p>
              {openTermination.reviewNote ? <p role="status">{openTermination.reviewNote}</p> : null}
              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() =>
                    askConfirm('Kündigung bestätigen?', async () => {
                      const result = await contractService.confirmTermination(
                        openTermination.id,
                        context,
                      );
                      setMessage(result.ok ? 'Bestätigt' : result.message ?? result.error);
                      await reload();
                    })
                  }
                >
                  Bestätigen
                </button>
                <button
                  type="button"
                  onClick={() =>
                    askConfirm('Kündigung zurückziehen?', async () => {
                      await contractService.withdrawTermination(openTermination.id, context);
                      await reload();
                    })
                  }
                >
                  Zurückziehen
                </button>
                <button
                  type="button"
                  onClick={() =>
                    askConfirm('Rückgewinnung starten?', async () => {
                      await contractService.startWinback(openTermination.id, context);
                      await reload();
                    })
                  }
                >
                  Rückgewinnung
                </button>
              </div>
            </>
          ) : hasPermission(currentUser.role, 'contracts.terminate') ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                void recordTermination();
              }}
            >
              <label>
                Grund
                <select
                  value={terminationReason}
                  onChange={(event) =>
                    setTerminationReason(event.target.value as ContractTerminationReason)
                  }
                >
                  {Object.entries(CONTRACT_TERMINATION_REASON_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {terminationReason === 'other' ? (
                <label>
                  Erläuterung
                  <input
                    required
                    value={terminationOther}
                    onChange={(event) => setTerminationOther(event.target.value)}
                  />
                </label>
              ) : null}
              <label>
                Gewünschtes Ende
                <input
                  type="date"
                  value={requestedEnd}
                  onChange={(event) => setRequestedEnd(event.target.value)}
                />
              </label>
              <button type="submit">Kündigung erfassen</button>
            </form>
          ) : (
            <EmptyState title="Keine Kündigung" description="Es liegt keine offene Kündigung vor." />
          )}
          {terminations.length > 0 ? (
            <>
              <h3>Verlauf</h3>
              <ul>
                {terminations.map((termination) => (
                  <li key={termination.id}>
                    {CONTRACT_TERMINATION_STATUS_LABELS[termination.status]} ·{' '}
                    {CONTRACT_TERMINATION_REASON_LABELS[termination.reason]} · {termination.receivedAt}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'documents' ? (
        <div className={styles.section} role="tabpanel" id="panel-documents" aria-labelledby="tab-documents">
          <h2>Dokumente</h2>
          {documents.length === 0 ? (
            <EmptyState title="Keine Dokumente" description="Metadaten erscheinen nach Erzeugung." />
          ) : (
            <ul>
              {documents.map((document) => (
                <li key={document.id}>
                  {SALES_DOCUMENT_TYPE_LABELS[document.type]} · {document.fileName} · Version{' '}
                  {document.contractVersionId ?? '–'}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === 'tasks' ? (
        <div className={styles.section} role="tabpanel" id="panel-tasks" aria-labelledby="tab-tasks">
          <h2>Aufgaben und Aktivitäten</h2>
          <h3>Aufgaben</h3>
          <ul>
            {tasks.map((task) => (
              <li key={task.id}>
                {task.title} · {SALES_TASK_TYPE_LABELS[task.type]} · {SALES_TASK_STATUS_LABELS[task.status]}
              </li>
            ))}
          </ul>
          <h3>Aktivitäten</h3>
          <ul>
            {activities.map((activity) => (
              <li key={activity.id}>
                {activity.title} · {SALES_ACTIVITY_TYPE_LABELS[activity.type]} · {activity.occurredAt.slice(0, 10)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={confirmTitle}
        message="Bitte bestätigen Sie diese kritische Vertragsaktion."
        confirmLabel="Bestätigen"
        cancelLabel="Abbrechen"
        onConfirm={() => {
          const action = confirmAction;
          setConfirmAction(null);
          if (action) void action();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </section>
  );
}
