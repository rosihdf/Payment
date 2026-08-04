import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { EmptyState } from '../../components/feedback/EmptyState';
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
import type { ActivationStatus } from '../../domain/activation/activationStatus';
import {
  getActivationDisplayGroup,
  getActivationDisplayLabel,
  type ActivationDisplayGroup,
} from '../../features/activation/activationStatusDisplay';
import {
  getContractDisplayGroup,
  getContractDisplayLabel,
  getContractTechnicalLabel,
  type ContractDisplayGroup,
} from '../../features/contract/contractStatusDisplay';
import type { SalesDocument } from '../../domain/salesDocument/salesDocument';
import { SALES_DOCUMENT_TYPE_LABELS } from '../../domain/salesDocument/salesDocument';
import type { SalesTask } from '../../domain/salesWorkspace/salesTask';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { FormField } from '../ui/FormField';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge, type StatusBadgeVariant } from '../ui/StatusBadge';
import styles from './ContractDetailPage.module.css';

type TabId = 'overview' | 'conditions' | 'changes' | 'termination' | 'documents';

function contractStatusVariant(group: ContractDisplayGroup): StatusBadgeVariant {
  switch (group) {
    case 'preparation':
      return 'neutral';
    case 'activation':
      return 'warning';
    case 'active':
      return 'success';
    case 'change_or_termination':
      return 'warning';
    case 'ended':
      return 'danger';
    case 'archived':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function activationStatusVariant(group: ActivationDisplayGroup): StatusBadgeVariant {
  switch (group) {
    case 'blocked':
      return 'danger';
    case 'live':
      return 'success';
    case 'closed':
      return 'neutral';
    case 'go_live':
      return 'info';
    default:
      return 'warning';
  }
}

function ActivationInlineBadge({ status }: { status: ActivationStatus }) {
  const group = getActivationDisplayGroup(status);
  return <StatusBadge variant={activationStatusVariant(group)} label={getActivationDisplayLabel(status)} />;
}

export function ContractDetailPage() {
  const { contractId = '' } = useParams();
  const { currentUser } = useCurrentUser();
  const { contractService, activationService, salesTaskService } = useServices();
  const [contract, setContract] = useState<Contract | null>(null);
  const [activation, setActivation] = useState<ActivationCase | null>(null);
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [terminations, setTerminations] = useState<ContractTermination[]>([]);
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [tasks, setTasks] = useState<SalesTask[]>([]);
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
  const [showChangeForm, setShowChangeForm] = useState(false);

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
    const [versionResult, terminationResult, documentResult, taskList, activationCase] =
      await Promise.all([
        contractService.listVersions(contractId, context),
        contractService.listTerminations(contractId, context),
        contractService.listDocuments(contractId, context),
        salesTaskService.listVisible(context),
        activationService.getByContractId(contractId, context),
      ]);
    if (versionResult.ok) setVersions(versionResult.value);
    if (terminationResult.ok) setTerminations(terminationResult.value);
    if (documentResult.ok) setDocuments(documentResult.value);
    setTasks(taskList.filter((task) => task.contractId === contractId));
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
        <PageHeader title="Vertrag" description="Daten werden geladen…" />
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

  const contractGroup = getContractDisplayGroup(contract.status);

  return (
    <section>
      <PageHeader
        title={contract.contractNumber}
        description={contract.customerCompanyName}
        actions={
          <div className={styles.headerActions}>
            <Link to="/contracts">
              <Button variant="secondary">Verträge</Button>
            </Link>
            {contract.leadId ? (
              <Link to={`/leads/${contract.leadId}`}>
                <Button variant="secondary">Zur Kundenakte</Button>
              </Link>
            ) : null}
            {contract.sourceOfferId ? (
              <Link to={`/offers/${contract.sourceOfferId}`}>
                <Button variant="secondary">Angebot</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <div className={styles.headerMeta}>
        <StatusBadge
          variant={contractStatusVariant(contractGroup)}
          label={getContractDisplayLabel(contract.status)}
          technicalLabel={currentUser.role === 'admin' ? getContractTechnicalLabel(contract.status) : undefined}
        />
        <span>Version {currentVersion?.versionNumber ?? '–'}</span>
        <span>
          {contract.startDate ?? '–'} – {contract.endDate ?? '–'}
        </span>
        <span>Nächste Aktion: {nextTask?.title ?? '–'}</span>
        {activation ? (
          <span>
            Aktivierung: <ActivationInlineBadge status={activation.status} /> {activation.progressPercent}%
          </span>
        ) : null}
      </div>

      {message ? <p role="status">{message}</p> : null}

      <div className={styles.actions}>
        {!activation &&
        hasPermission(currentUser.role, 'activations.create') &&
        ['preparation', 'activation'].includes(contract.status) ? (
          <Button
            onClick={() =>
              askConfirm('Aktivierung starten?', async () => {
                const result = await activationService.startFromContract(contract.id, context);
                setMessage(
                  result.ok
                    ? `Aktivierung ${result.value.activationNumber} gestartet`
                    : result.message ?? result.error,
                );
                await reload();
              })
            }
          >
            Aktivierung starten
          </Button>
        ) : hasPermission(currentUser.role, 'contracts.suspend') && contract.status === 'active' ? (
          <Button
            onClick={() =>
              askConfirm('Vertrag sperren?', async () => {
                await contractService.transitionStatus(contract.id, 'suspended', context);
                await reload();
              })
            }
          >
            Sperren
          </Button>
        ) : hasPermission(currentUser.role, 'contracts.suspend') && contract.status === 'suspended' ? (
          <Button
            onClick={() =>
              askConfirm('Vertrag reaktivieren?', async () => {
                await contractService.transitionStatus(contract.id, 'active', context);
                await reload();
              })
            }
          >
            Reaktivieren
          </Button>
        ) : activation ? (
          <Link to={`/activations/${activation.id}`}>
            <Button>Aktivierung öffnen</Button>
          </Link>
        ) : null}
        {hasPermission(currentUser.role, 'contracts.extend') ? (
          <Button
            variant="text"
            onClick={() =>
              void contractService
                .extendContract(contract.id, { additionalMonths: 12 }, context)
                .then(async (result) => {
                  setMessage(result.ok ? 'Verlängerung vorbereitet' : result.message ?? result.error);
                  await reload();
                })
            }
          >
            Verlängerung vorbereiten
          </Button>
        ) : null}
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Vertragsbereiche">
        {(
          [
            ['overview', 'Übersicht'],
            ['conditions', 'Konditionen'],
            ['changes', 'Änderungen'],
            ['termination', 'Kündigung'],
            ['documents', 'Dokumente'],
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
              <span className={styles.label}>Vertragsnummer</span>
              <span>{contract.contractNumber}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Kunde</span>
              <span>{contract.customerCompanyName}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Aktuelle Version</span>
              <span>{currentVersion.versionNumber}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Laufzeit</span>
              <span>{currentVersion.snapshot.termMonths ?? '–'} Monate</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Beginn / Ende</span>
              <span>
                {contract.startDate ?? '–'} – {contract.endDate ?? '–'}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Tarif</span>
              <span>{currentVersion.snapshot.tariffSnapshot?.name ?? '–'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Hardwareanzahl</span>
              <span>
                {currentVersion.snapshot.hardware.reduce((sum, line) => sum + line.quantity, 0)}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Aktivierungsstatus</span>
              <span>
                {activation ? (
                  <>
                    <ActivationInlineBadge status={activation.status} /> · {activation.progressPercent}%
                  </>
                ) : (
                  'Keine Aktivierung'
                )}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Aufgaben & Verlauf</span>
              <span>
                {contract.leadId ? (
                  <Link to={`/leads/${contract.leadId}`}>In der Kundenakte öffnen</Link>
                ) : (
                  '–'
                )}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'conditions' && currentVersion ? (
        <div className={styles.section} role="tabpanel" id="panel-conditions" aria-labelledby="tab-conditions">
          <h2>Konditionen</h2>
          <div className={styles.grid}>
            <div className={styles.row}>
              <span className={styles.label}>Vertragsmodell</span>
              <span>{OFFER_CONTRACT_MODEL_LABELS[currentVersion.snapshot.contractModel]}</span>
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

          <h3>Versionen</h3>
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
          <h2>Änderungen</h2>
          {hasPermission(currentUser.role, 'contracts.change') ? (
            <>
              <Button variant="secondary" onClick={() => setShowChangeForm((current) => !current)}>
                {showChangeForm ? 'Änderung ausblenden' : 'Vertrag ändern'}
              </Button>
              {showChangeForm ? (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void startChange();
                  }}
                >
                  <FormField
                    type="select"
                    label="Änderungsart"
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
                  </FormField>
                  <FormField type="text" label="Notiz" value={changeNote} onChange={(event) => setChangeNote(event.target.value)} />
                  <FormField type="date" label="Gültig ab (optional)" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
                  <FormField type="text" label="Neue Laufzeit (Monate)" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} />
                  <FormField type="text" label="Monatliche Gebühr (€)" value={monthlyFee} onChange={(event) => setMonthlyFee(event.target.value)} />
                  <FormField type="text" label="Nachname Ansprechpartner" value={contactLastName} onChange={(event) => setContactLastName(event.target.value)} />
                  <Button type="submit">Änderung starten</Button>
                </form>
              ) : null}
            </>
          ) : null}
          {planned.map((version) => (
            <div key={version.id} className={styles.row}>
              <span>
                Geplant V{version.versionNumber} ab {version.validFrom} (
                {version.approvalRequired ? 'Freigabe nötig' : 'ohne Freigabe'})
              </span>
              <div className={styles.actions}>
                <Button
                  size="compact"
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
                </Button>
                <Button
                  size="compact"
                  variant="secondary"
                  onClick={() =>
                    askConfirm('Version verwerfen?', async () => {
                      await contractService.discardVersion(contract.id, version.id, context);
                      await reload();
                    })
                  }
                >
                  Verwerfen
                </Button>
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
                <Button
                  size="compact"
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
                </Button>
                <Button
                  size="compact"
                  variant="secondary"
                  onClick={() =>
                    askConfirm('Kündigung zurückziehen?', async () => {
                      await contractService.withdrawTermination(openTermination.id, context);
                      await reload();
                    })
                  }
                >
                  Zurückziehen
                </Button>
                <Button
                  size="compact"
                  variant="secondary"
                  onClick={() =>
                    askConfirm('Rückgewinnung starten?', async () => {
                      await contractService.startWinback(openTermination.id, context);
                      await reload();
                    })
                  }
                >
                  Rückgewinnung
                </Button>
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
              <FormField
                type="select"
                label="Grund"
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
              </FormField>
              {terminationReason === 'other' ? (
                <FormField type="text" label="Erläuterung" required value={terminationOther} onChange={(event) => setTerminationOther(event.target.value)} />
              ) : null}
              <FormField type="date" label="Gewünschtes Ende" value={requestedEnd} onChange={(event) => setRequestedEnd(event.target.value)} />
              <Button type="submit">Kündigung erfassen</Button>
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

      <Dialog
        isOpen={Boolean(confirmAction)}
        title={confirmTitle}
        onClose={() => setConfirmAction(null)}
        secondaryAction={{ label: 'Abbrechen', onClick: () => setConfirmAction(null) }}
        primaryAction={{
          label: 'Bestätigen',
          onClick: () => {
            const action = confirmAction;
            setConfirmAction(null);
            if (action) void action();
          },
        }}
      >
        <p>Bitte bestätigen Sie diese kritische Vertragsaktion.</p>
      </Dialog>
    </section>
  );
}
