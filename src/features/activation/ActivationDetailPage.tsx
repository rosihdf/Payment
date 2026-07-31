import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import type { ActivationApplication, ActivationApplicationType } from '../../domain/activation/activationApplication';
import { ACTIVATION_APPLICATION_STATUS_LABELS, ACTIVATION_APPLICATION_TYPE_LABELS } from '../../domain/activation/activationApplication';
import type { ActivationBlocker, ActivationBlockerCategory, ActivationBlockerSeverity } from '../../domain/activation/activationBlocker';
import { ACTIVATION_BLOCKER_CATEGORY_LABELS, ACTIVATION_BLOCKER_SEVERITY_LABELS } from '../../domain/activation/activationBlocker';
import type { ActivationCase } from '../../domain/activation/activationCase';
import { ACTIVATION_PRIORITY_LABELS } from '../../domain/activation/activationCase';
import type { ActivationChecklistItem } from '../../domain/activation/activationChecklist';
import { ACTIVATION_CHECKLIST_CATEGORY_LABELS, ACTIVATION_CHECKLIST_CATEGORY_ORDER, ACTIVATION_CHECKLIST_ITEM_STATUS_LABELS } from '../../domain/activation/activationChecklist';
import type { ActivationHardwareAssignment } from '../../domain/activation/activationHardware';
import { ACTIVATION_HARDWARE_STATUS_LABELS } from '../../domain/activation/activationHardware';
import { ACTIVATION_STATUS_LABELS, getAllowedActivationStatusTransitions, type ActivationStatus } from '../../domain/activation/activationStatus';
import { hasPermission } from '../../domain/permission/permission';
import type { SalesDocument, SalesDocumentType } from '../../domain/salesDocument/salesDocument';
import { SALES_DOCUMENT_TYPE_LABELS } from '../../domain/salesDocument/salesDocument';
import type { SalesActivity } from '../../domain/salesWorkspace/salesActivity';
import { SALES_ACTIVITY_TYPE_LABELS } from '../../domain/salesWorkspace/salesActivity';
import type { SalesTask } from '../../domain/salesWorkspace/salesTask';
import { SALES_TASK_STATUS_LABELS, SALES_TASK_TYPE_LABELS } from '../../domain/salesWorkspace/salesTask';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { ActivationStatusBadge } from './ActivationStatusBadge';
import styles from './ActivationDetailPage.module.css';

type TabId = 'overview' | 'checklist' | 'documents' | 'applications' | 'hardware' | 'setup_test' | 'blockers' | 'tasks';

const ACTIVATION_DOCUMENT_TYPES: SalesDocumentType[] = [
  'activation_identification',
  'activation_merchant_application',
  'activation_acquiring_application',
  'activation_hardware_delivery',
  'activation_setup_confirmation',
  'activation_test_confirmation',
  'activation_completion',
];

function toUserContext(user: { id: string; role: import('../../domain/user/user').UserRole; name: string; status: import('../../domain/user/user').UserStatus }) {
  return {
    userId: user.id,
    role: user.role,
    displayName: user.name,
    status: user.status,
  };
}

export function ActivationDetailPage() {
  const { activationId = '' } = useParams();
  const { currentUser } = useCurrentUser();
  const { activationService, salesTaskService, salesActivityService } = useServices();

  const [activation, setActivation] = useState<ActivationCase | null>(null);
  const [checklist, setChecklist] = useState<ActivationChecklistItem[]>([]);
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [applications, setApplications] = useState<ActivationApplication[]>([]);
  const [hardware, setHardware] = useState<ActivationHardwareAssignment[]>([]);
  const [blockers, setBlockers] = useState<ActivationBlocker[]>([]);
  const [tasks, setTasks] = useState<SalesTask[]>([]);
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [tab, setTab] = useState<TabId>('overview');
  const [error, setError] = useState<'forbidden' | 'not_found' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null);
  const [confirmTitle, setConfirmTitle] = useState('');

  const [newApplicationType, setNewApplicationType] = useState<ActivationApplicationType>('merchant_setup');
  const [newApplicationTitle, setNewApplicationTitle] = useState('');
  const [applicationNoteDrafts, setApplicationNoteDrafts] = useState<Record<string, string>>({});

  const [documentChecklistItemId, setDocumentChecklistItemId] = useState('');
  const [documentType, setDocumentType] = useState<SalesDocumentType>('activation_identification');
  const [documentFileName, setDocumentFileName] = useState('');

  const [testAnonymizedReference, setTestAnonymizedReference] = useState('');
  const [testHardwareId, setTestHardwareId] = useState('');
  const [setupNote, setSetupNote] = useState('');

  const [newBlockerCategory, setNewBlockerCategory] = useState<ActivationBlockerCategory>('other');
  const [newBlockerSeverity, setNewBlockerSeverity] = useState<ActivationBlockerSeverity>('warning');
  const [newBlockerTitle, setNewBlockerTitle] = useState('');
  const [newBlockerDescription, setNewBlockerDescription] = useState('');
  const [blockerResolutionDrafts, setBlockerResolutionDrafts] = useState<Record<string, string>>({});

  const [serialDrafts, setSerialDrafts] = useState<Record<string, string>>({});
  const [handoverDrafts, setHandoverDrafts] = useState<Record<string, string>>({});
  const [deviationDrafts, setDeviationDrafts] = useState<Record<string, string>>({});

  const context = currentUser ? toUserContext(currentUser) : null;

  const reload = async () => {
    if (!context || !activationId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const result = await activationService.getById(activationId, context);
    if (!result.ok) {
      setError(result.error === 'forbidden' ? 'forbidden' : 'not_found');
      setIsLoading(false);
      return;
    }
    setActivation(result.value);
    setError(null);
    const [checklistResult, documentResult, applicationResult, hardwareResult, blockerResult, taskList, activityList] =
      await Promise.all([
        activationService.listChecklistItems(activationId, context),
        activationService.listDocuments(activationId, context),
        activationService.listApplications(activationId, context),
        activationService.listHardware(activationId, context),
        activationService.listBlockers(activationId, context),
        salesTaskService.listVisible(context),
        salesActivityService.listVisible(context),
      ]);
    if (checklistResult.ok) setChecklist([...checklistResult.value].sort((a, b) => a.sortOrder - b.sortOrder));
    if (documentResult.ok) setDocuments(documentResult.value);
    if (applicationResult.ok) setApplications(applicationResult.value);
    if (hardwareResult.ok) setHardware(hardwareResult.value);
    if (blockerResult.ok) setBlockers(blockerResult.value);
    setTasks(taskList.filter((task) => task.activationId === activationId));
    setActivities(activityList.filter((activity) => activity.activationId === activationId));
    setIsLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activationId, currentUser?.id]);

  if (!currentUser || !context) return null;
  if (isLoading && !activation) {
    return (
      <section>
        <PageHeader title="Aktivierung" subtitle="Daten werden geladen…" />
        <EmptyState title="Aktivierung wird geladen" description="Die Aktivierungsdetails werden abgerufen." />
      </section>
    );
  }
  if (error === 'forbidden') return <AccessDenied title="Kein Zugriff auf diese Aktivierung" />;
  if (error === 'not_found' || !activation) {
    return <EmptyState title="Aktivierung nicht gefunden" description="Die Referenz ist ungültig oder fehlt." />;
  }

  const askConfirm = (title: string, action: () => Promise<void>) => {
    setConfirmTitle(title);
    setConfirmAction(() => action);
  };

  const runResult = async (result: { ok: boolean; error?: string; message?: string; warning?: string }) => {
    if (result.ok) {
      setMessage(result.warning ?? 'Aktion ausgeführt');
    } else {
      setMessage(result.message ?? result.error ?? 'Aktion fehlgeschlagen');
    }
    await reload();
  };

  const openChecklistItems = checklist.filter((item) => item.status !== 'not_applicable');
  const allowedTransitions = getAllowedActivationStatusTransitions(activation.status).filter(
    (status) => status !== 'live' && status !== 'cancelled',
  );

  return (
    <section>
      <PageHeader
        title={activation.activationNumber}
        subtitle={`Vertrag ${activation.contractId}`}
        actions={
          <div className={styles.actions}>
            <Link className={styles.linkButton} to="/activations">Aktivierungen</Link>
            <Link className={styles.linkButton} to={`/contracts/${activation.contractId}`}>Vertrag öffnen</Link>
          </div>
        }
      />

      <div className={styles.headerMeta}>
        <ActivationStatusBadge status={activation.status} />
        <span>Priorität: {ACTIVATION_PRIORITY_LABELS[activation.priority]}</span>
        <span>Fortschritt: {activation.progressPercent}%</span>
        <span>Nächster Schritt: {activation.nextStep ?? '–'}</span>
        <span>Nächste Frist: {activation.nextDueAt ? activation.nextDueAt.slice(0, 10) : '–'}</span>
        <span>Offene Blocker: {activation.openBlockerCount}</span>
        <span>Offene Pflichtpunkte: {activation.openMandatoryCount}</span>
      </div>

      {message ? <p role="status">{message}</p> : null}

      {hasPermission(currentUser.role, 'activations.update') ? (
        <div className={styles.actions}>
          {allowedTransitions.map((nextStatus) => (
            <button
              key={nextStatus}
              type="button"
              onClick={() =>
                askConfirm(`Status auf „${ACTIVATION_STATUS_LABELS[nextStatus]}“ setzen?`, async () => {
                  await runResult(await activationService.transitionStatus(activation.id, nextStatus as ActivationStatus, context));
                })
              }
            >
              {ACTIVATION_STATUS_LABELS[nextStatus]}
            </button>
          ))}
          {hasPermission(currentUser.role, 'activations.go_live') && activation.status === 'go_live_ready' ? (
            <button
              type="button"
              onClick={() =>
                askConfirm('Go-live bestätigen?', async () => {
                  await runResult(await activationService.confirmGoLive(activation.id, context));
                })
              }
            >
              Go-live bestätigen
            </button>
          ) : null}
          {hasPermission(currentUser.role, 'activations.go_live') && activation.status === 'live' ? (
            <button
              type="button"
              onClick={() => {
                const reason = window.prompt('Grund für die Rücknahme des Go-live:');
                if (reason === null) return;
                askConfirm('Go-live zurücknehmen?', async () => {
                  await runResult(await activationService.revokeGoLive(activation.id, reason, context));
                });
              }}
            >
              Go-live zurücknehmen
            </button>
          ) : null}
          {hasPermission(currentUser.role, 'activations.complete') && activation.status === 'live' ? (
            <button
              type="button"
              onClick={() =>
                askConfirm('Aktivierung abschließen?', async () => {
                  await runResult(await activationService.completeActivation(activation.id, context));
                })
              }
            >
              Abschließen
            </button>
          ) : null}
          {hasPermission(currentUser.role, 'activations.complete') && activation.status === 'completed' && !activation.handedOverAt ? (
            <button
              type="button"
              onClick={() =>
                askConfirm('Übergabe bestätigen?', async () => {
                  await runResult(await activationService.confirmHandover(activation.id, context));
                })
              }
            >
              Übergabe bestätigen
            </button>
          ) : null}
          {hasPermission(currentUser.role, 'activations.cancel') && !['completed', 'cancelled', 'archived'].includes(activation.status) ? (
            <button
              type="button"
              onClick={() => {
                const reason = window.prompt('Grund für den Abbruch:');
                if (reason === null) return;
                askConfirm('Aktivierung abbrechen?', async () => {
                  await runResult(await activationService.cancelActivation(activation.id, reason, context));
                });
              }}
            >
              Abbrechen
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={styles.tabs} role="tablist" aria-label="Aktivierungsbereiche">
        {(
          [
            ['overview', 'Übersicht'],
            ['checklist', 'Checkliste'],
            ['documents', 'Dokumente'],
            ['applications', 'Anträge'],
            ['hardware', 'Hardware'],
            ['setup_test', 'Einrichtung & Test'],
            ['blockers', 'Blocker'],
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

      {tab === 'overview' ? (
        <div className={styles.section} role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
          <h2>Übersicht</h2>
          <div className={styles.grid}>
            <div className={styles.row}>
              <span className={styles.label}>Geplanter Start</span>
              <span>{activation.plannedStart ?? '–'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Gewünschter Go-live</span>
              <span>{activation.desiredGoLive ?? '–'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Bestätigter Go-live</span>
              <span>{activation.confirmedGoLive ?? '–'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Abgeschlossen am</span>
              <span>{activation.completedAt?.slice(0, 10) ?? '–'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Übergeben am</span>
              <span>{activation.handedOverAt?.slice(0, 10) ?? '–'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Eigentümer</span>
              <span>{activation.ownerUserId}</span>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'checklist' ? (
        <div className={styles.section} role="tabpanel" id="panel-checklist" aria-labelledby="tab-checklist">
          <h2>Checkliste</h2>
          {openChecklistItems.length === 0 ? (
            <EmptyState title="Keine Checklistenpunkte" description="Es liegen keine Punkte vor." />
          ) : (
            ACTIVATION_CHECKLIST_CATEGORY_ORDER.map((category) => {
              const items = checklist.filter((item) => item.category === category);
              if (items.length === 0) return null;
              return (
                <div key={category} className={styles.categoryBlock}>
                  <h3>{ACTIVATION_CHECKLIST_CATEGORY_LABELS[category]}</h3>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Punkt</th>
                          <th>Status</th>
                          <th>Pflicht</th>
                          <th>Beleg</th>
                          <th>Aktion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              {item.title}
                              {item.note ? <div className={styles.note}>{item.note}</div> : null}
                            </td>
                            <td>{ACTIVATION_CHECKLIST_ITEM_STATUS_LABELS[item.status]}</td>
                            <td>{item.required ? 'Ja' : 'Nein'}</td>
                            <td>{item.evidenceRequired ? (item.documentId ? 'Vorhanden' : 'Erforderlich') : '–'}</td>
                            <td>
                              {hasPermission(currentUser.role, 'activations.update') && item.status !== 'done' ? (
                                <div className={styles.inlineActions}>
                                  <button
                                    type="button"
                                    onClick={async () =>
                                      void runResult(
                                        await activationService.updateChecklistItem(
                                          activation.id,
                                          item.id,
                                          { status: 'done' },
                                          context,
                                        ),
                                      )
                                    }
                                  >
                                    Erledigt
                                  </button>
                                  {item.status === 'open' ? (
                                    <button
                                      type="button"
                                      onClick={async () =>
                                        void runResult(
                                          await activationService.updateChecklistItem(
                                            activation.id,
                                            item.id,
                                            { status: 'in_progress' },
                                            context,
                                          ),
                                        )
                                      }
                                    >
                                      In Bearbeitung
                                    </button>
                                  ) : null}
                                  {!item.required ? (
                                    <button
                                      type="button"
                                      onClick={async () =>
                                        void runResult(
                                          await activationService.updateChecklistItem(
                                            activation.id,
                                            item.id,
                                            { status: 'not_applicable' },
                                            context,
                                          ),
                                        )
                                      }
                                    >
                                      Entfällt
                                    </button>
                                  ) : null}
                                </div>
                              ) : (
                                '–'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {tab === 'documents' ? (
        <div className={styles.section} role="tabpanel" id="panel-documents" aria-labelledby="tab-documents">
          <h2>Dokumente</h2>
          {hasPermission(currentUser.role, 'activations.documents') ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (!documentChecklistItemId || !documentFileName.trim()) return;
                void (async () => {
                  const result = await activationService.reviewDocument(
                    activation.id,
                    {
                      checklistItemId: documentChecklistItemId,
                      type: documentType,
                      fileName: documentFileName.trim(),
                      mimeType: 'application/pdf',
                    },
                    context,
                  );
                  await runResult(result);
                  setDocumentFileName('');
                })();
              }}
            >
              <label>
                Checklistenpunkt
                <select value={documentChecklistItemId} onChange={(event) => setDocumentChecklistItemId(event.target.value)}>
                  <option value="">Bitte wählen</option>
                  {checklist
                    .filter((item) => item.evidenceRequired)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Dokumenttyp
                <select value={documentType} onChange={(event) => setDocumentType(event.target.value as SalesDocumentType)}>
                  {ACTIVATION_DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SALES_DOCUMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Dateiname
                <input value={documentFileName} onChange={(event) => setDocumentFileName(event.target.value)} required />
              </label>
              <button type="submit">Dokument erfassen (Beleg geprüft)</button>
            </form>
          ) : null}
          {documents.length === 0 ? (
            <EmptyState title="Keine Dokumente" description="Metadaten erscheinen nach Erfassung." />
          ) : (
            <ul>
              {documents.map((document) => (
                <li key={document.id}>
                  {SALES_DOCUMENT_TYPE_LABELS[document.type]} · {document.fileName} · {document.createdAt.slice(0, 10)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === 'applications' ? (
        <div className={styles.section} role="tabpanel" id="panel-applications" aria-labelledby="tab-applications">
          <h2>Anträge</h2>
          {hasPermission(currentUser.role, 'activations.applications') ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (!newApplicationTitle.trim()) return;
                void (async () => {
                  const result = await activationService.createApplication(
                    activation.id,
                    { type: newApplicationType, title: newApplicationTitle },
                    context,
                  );
                  await runResult(result);
                  setNewApplicationTitle('');
                })();
              }}
            >
              <label>
                Typ
                <select value={newApplicationType} onChange={(event) => setNewApplicationType(event.target.value as ActivationApplicationType)}>
                  {Object.entries(ACTIVATION_APPLICATION_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Titel
                <input value={newApplicationTitle} onChange={(event) => setNewApplicationTitle(event.target.value)} required />
              </label>
              <button type="submit">Antrag anlegen</button>
            </form>
          ) : null}
          {applications.length === 0 ? (
            <EmptyState title="Keine Anträge" description="Es wurden noch keine Anträge angelegt." />
          ) : (
            <ul className={styles.entityList}>
              {applications.map((application) => (
                <li key={application.id} className={styles.entityCard}>
                  <div className={styles.cardHeader}>
                    <strong>{application.title}</strong>
                    <span>{ACTIVATION_APPLICATION_STATUS_LABELS[application.status]}</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>{ACTIVATION_APPLICATION_TYPE_LABELS[application.type]}</span>
                    {application.referenceNumber ? <span>Referenz: {application.referenceNumber}</span> : null}
                    {application.inquiryNote ? <span>Rückfrage: {application.inquiryNote}</span> : null}
                    {application.decisionNote ? <span>Entscheidung: {application.decisionNote}</span> : null}
                  </div>
                  {hasPermission(currentUser.role, 'activations.applications') ? (
                    <div className={styles.inlineActions}>
                      {(application.status === 'draft' || application.status === 'ready') ? (
                        <button
                          type="button"
                          onClick={async () => void runResult(await activationService.submitApplication(application.id, context))}
                        >
                          Einreichen
                        </button>
                      ) : null}
                      {application.status === 'submitted' || application.status === 'in_review' ? (
                        <>
                          <input
                            placeholder="Rückfragehinweis"
                            value={applicationNoteDrafts[application.id] ?? ''}
                            onChange={(event) =>
                              setApplicationNoteDrafts((prev) => ({ ...prev, [application.id]: event.target.value }))
                            }
                          />
                          <button
                            type="button"
                            onClick={async () =>
                              void runResult(
                                await activationService.markInquiry(
                                  application.id,
                                  applicationNoteDrafts[application.id] ?? '',
                                  context,
                                ),
                              )
                            }
                          >
                            Rückfrage
                          </button>
                          <button
                            type="button"
                            onClick={async () =>
                              void runResult(
                                await activationService.approveApplication(
                                  application.id,
                                  applicationNoteDrafts[application.id] ?? '',
                                  context,
                                ),
                              )
                            }
                          >
                            Genehmigen
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const note = applicationNoteDrafts[application.id] ?? '';
                              if (!note.trim()) {
                                setMessage('Für die Ablehnung ist eine Begründung erforderlich.');
                                return;
                              }
                              void runResult(await activationService.rejectApplication(application.id, note, context));
                            }}
                          >
                            Ablehnen
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === 'hardware' ? (
        <div className={styles.section} role="tabpanel" id="panel-hardware" aria-labelledby="tab-hardware">
          <h2>Hardware</h2>
          {hardware.length === 0 ? (
            <EmptyState title="Keine Hardware" description="Für diesen Vertrag ist keine Hardware hinterlegt." />
          ) : (
            <ul className={styles.entityList}>
              {hardware.map((unit) => (
                <li key={unit.id} className={styles.entityCard}>
                  <div className={styles.cardHeader}>
                    <strong>{unit.model || unit.productName || 'Gerät'}</strong>
                    <span>{ACTIVATION_HARDWARE_STATUS_LABELS[unit.status]}</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>Seriennummer: {unit.serialNumber ?? '–'}</span>
                    <span>Bestellt: {unit.orderedAt?.slice(0, 10) ?? '–'}</span>
                    <span>Versendet: {unit.shippedAt?.slice(0, 10) ?? '–'}</span>
                    <span>Zugestellt: {unit.deliveredAt?.slice(0, 10) ?? '–'}</span>
                    <span>Eingerichtet: {unit.setupAt?.slice(0, 10) ?? '–'}</span>
                    <span>Getestet: {unit.testedAt?.slice(0, 10) ?? '–'}</span>
                    {unit.handoverAt ? <span>Übergeben an: {unit.handoverToName}</span> : null}
                  </div>
                  {hasPermission(currentUser.role, 'activations.hardware') ? (
                    <div className={styles.inlineActions}>
                      {unit.status === 'planned' ? (
                        <button
                          type="button"
                          onClick={async () =>
                            void runResult(
                              await activationService.updateHardware(activation.id, unit.id, { kind: 'order' }, context),
                            )
                          }
                        >
                          Bestellen
                        </button>
                      ) : null}
                      {unit.status === 'ordered' ? (
                        <>
                          <input
                            placeholder="Seriennummer"
                            value={serialDrafts[unit.id] ?? ''}
                            onChange={(event) => setSerialDrafts((prev) => ({ ...prev, [unit.id]: event.target.value }))}
                          />
                          <button
                            type="button"
                            onClick={async () =>
                              void runResult(
                                await activationService.updateHardware(
                                  activation.id,
                                  unit.id,
                                  { kind: 'assign', serialNumber: serialDrafts[unit.id] ?? '' },
                                  context,
                                ),
                              )
                            }
                          >
                            Seriennummer zuordnen
                          </button>
                        </>
                      ) : null}
                      {unit.status === 'assigned' ? (
                        <button
                          type="button"
                          onClick={async () =>
                            void runResult(
                              await activationService.updateHardware(activation.id, unit.id, { kind: 'ship' }, context),
                            )
                          }
                        >
                          Versenden
                        </button>
                      ) : null}
                      {unit.status === 'shipped' ? (
                        <button
                          type="button"
                          onClick={async () =>
                            void runResult(
                              await activationService.updateHardware(activation.id, unit.id, { kind: 'deliver' }, context),
                            )
                          }
                        >
                          Zustellung bestätigen
                        </button>
                      ) : null}
                      {unit.status === 'delivered' && hasPermission(currentUser.role, 'activations.setup') ? (
                        <button
                          type="button"
                          onClick={async () =>
                            void runResult(
                              await activationService.updateHardware(activation.id, unit.id, { kind: 'setup' }, context),
                            )
                          }
                        >
                          Einrichtung bestätigen
                        </button>
                      ) : null}
                      {unit.status === 'setup' && hasPermission(currentUser.role, 'activations.test') ? (
                        <button
                          type="button"
                          onClick={async () =>
                            void runResult(
                              await activationService.updateHardware(activation.id, unit.id, { kind: 'test' }, context),
                            )
                          }
                        >
                          Test bestätigen
                        </button>
                      ) : null}
                      {unit.status === 'tested' ? (
                        <>
                          <input
                            placeholder="Übergabe an"
                            value={handoverDrafts[unit.id] ?? ''}
                            onChange={(event) => setHandoverDrafts((prev) => ({ ...prev, [unit.id]: event.target.value }))}
                          />
                          <button
                            type="button"
                            onClick={async () =>
                              void runResult(
                                await activationService.updateHardware(
                                  activation.id,
                                  unit.id,
                                  { kind: 'handover', toName: handoverDrafts[unit.id] ?? '' },
                                  context,
                                ),
                              )
                            }
                          >
                            Übergeben
                          </button>
                        </>
                      ) : null}
                      <input
                        placeholder="Abweichung beschreiben"
                        value={deviationDrafts[unit.id] ?? ''}
                        onChange={(event) => setDeviationDrafts((prev) => ({ ...prev, [unit.id]: event.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const description = deviationDrafts[unit.id] ?? '';
                          if (!description.trim()) {
                            setMessage('Beschreibung der Abweichung ist erforderlich.');
                            return;
                          }
                          await runResult(
                            await activationService.recordHardwareDeviation(
                              activation.id,
                              unit.id,
                              { description },
                              context,
                            ),
                          );
                        }}
                      >
                        Abweichung melden
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === 'setup_test' ? (
        <div className={styles.section} role="tabpanel" id="panel-setup_test" aria-labelledby="tab-setup_test">
          <h2>Einrichtung &amp; Test</h2>
          {hasPermission(currentUser.role, 'activations.setup') ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                void (async () => {
                  const result = await activationService.updateSetup(activation.id, { note: setupNote }, context);
                  await runResult(result);
                  setSetupNote('');
                })();
              }}
            >
              <label>
                Notiz zur Einrichtung
                <input value={setupNote} onChange={(event) => setSetupNote(event.target.value)} />
              </label>
              <button type="submit">Einrichtung dokumentieren</button>
            </form>
          ) : null}
          {hasPermission(currentUser.role, 'activations.test') ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (!testAnonymizedReference.trim()) return;
                void (async () => {
                  const result = await activationService.recordTestPayment(
                    activation.id,
                    {
                      hardwareId: testHardwareId || undefined,
                      anonymizedReference: testAnonymizedReference,
                      result: 'success',
                    },
                    context,
                  );
                  await runResult(result);
                  setTestAnonymizedReference('');
                })();
              }}
            >
              <label>
                Gerät (optional)
                <select value={testHardwareId} onChange={(event) => setTestHardwareId(event.target.value)}>
                  <option value="">Keine Auswahl</option>
                  {hardware.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.model || unit.productName || unit.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Anonymisierte Referenz
                <input
                  value={testAnonymizedReference}
                  onChange={(event) => setTestAnonymizedReference(event.target.value)}
                  placeholder="z. B. TEST-0001 (keine Kartendaten)"
                  required
                />
              </label>
              <div className={styles.inlineActions}>
                <button type="submit">Testzahlung erfolgreich</button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!testAnonymizedReference.trim()) return;
                    await runResult(
                      await activationService.recordTestPayment(
                        activation.id,
                        {
                          hardwareId: testHardwareId || undefined,
                          anonymizedReference: testAnonymizedReference,
                          result: 'failed',
                        },
                        context,
                      ),
                    );
                    setTestAnonymizedReference('');
                  }}
                >
                  Testzahlung fehlgeschlagen
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {tab === 'blockers' ? (
        <div className={styles.section} role="tabpanel" id="panel-blockers" aria-labelledby="tab-blockers">
          <h2>Blocker</h2>
          {hasPermission(currentUser.role, 'activations.blockers') ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (!newBlockerTitle.trim() || !newBlockerDescription.trim()) return;
                void (async () => {
                  const result = await activationService.createBlocker(
                    activation.id,
                    {
                      category: newBlockerCategory,
                      severity: newBlockerSeverity,
                      title: newBlockerTitle,
                      description: newBlockerDescription,
                    },
                    context,
                  );
                  await runResult(result);
                  setNewBlockerTitle('');
                  setNewBlockerDescription('');
                })();
              }}
            >
              <label>
                Kategorie
                <select value={newBlockerCategory} onChange={(event) => setNewBlockerCategory(event.target.value as ActivationBlockerCategory)}>
                  {Object.entries(ACTIVATION_BLOCKER_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Schweregrad
                <select value={newBlockerSeverity} onChange={(event) => setNewBlockerSeverity(event.target.value as ActivationBlockerSeverity)}>
                  {Object.entries(ACTIVATION_BLOCKER_SEVERITY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Titel
                <input value={newBlockerTitle} onChange={(event) => setNewBlockerTitle(event.target.value)} required />
              </label>
              <label>
                Beschreibung
                <input value={newBlockerDescription} onChange={(event) => setNewBlockerDescription(event.target.value)} required />
              </label>
              <button type="submit">Blocker erfassen</button>
            </form>
          ) : null}
          {blockers.length === 0 ? (
            <EmptyState title="Keine Blocker" description="Es liegen keine offenen oder gelösten Blocker vor." />
          ) : (
            <ul className={styles.entityList}>
              {blockers.map((blocker) => (
                <li key={blocker.id} className={styles.entityCard}>
                  <div className={styles.cardHeader}>
                    <strong>{blocker.title}</strong>
                    <span>{ACTIVATION_BLOCKER_SEVERITY_LABELS[blocker.severity]}</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>{ACTIVATION_BLOCKER_CATEGORY_LABELS[blocker.category]}</span>
                    <span>{blocker.description}</span>
                    <span>Status: {blocker.status === 'open' ? 'Offen' : 'Gelöst'}</span>
                    {blocker.resolutionNote ? <span>Lösung: {blocker.resolutionNote}</span> : null}
                  </div>
                  {blocker.status === 'open' && hasPermission(currentUser.role, 'activations.blockers') ? (
                    <div className={styles.inlineActions}>
                      <input
                        placeholder="Lösung"
                        value={blockerResolutionDrafts[blocker.id] ?? ''}
                        onChange={(event) =>
                          setBlockerResolutionDrafts((prev) => ({ ...prev, [blocker.id]: event.target.value }))
                        }
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const note = blockerResolutionDrafts[blocker.id] ?? '';
                          if (!note.trim()) {
                            setMessage('Lösung ist erforderlich, um einen Blocker zu schließen.');
                            return;
                          }
                          void runResult(await activationService.resolveBlocker(blocker.id, note, context));
                        }}
                      >
                        Lösen
                      </button>
                    </div>
                  ) : null}
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
        message="Bitte bestätigen Sie diese kritische Aktivierungsaktion."
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
