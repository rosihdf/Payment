import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FormField } from '../../components/common/FormField';
import { SearchField } from '../../components/common/SearchField';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  SALES_ACTIVITY_TYPE_LABELS,
  type SalesActivityType,
} from '../../domain/salesWorkspace/salesActivity';
import {
  SALES_PIPELINE_PHASE_LABELS,
  SALES_PIPELINE_PHASES,
  type SalesPipelinePhase,
} from '../../domain/salesWorkspace/salesPipeline';
import {
  SALES_TASK_PRIORITY_LABELS,
  SALES_TASK_TYPE_LABELS,
  type SalesTaskType,
} from '../../domain/salesWorkspace/salesTask';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { SalesCaseCard, SalesWorkspaceView } from '../../services/salesWorkspaceService';
import { formatDateTime } from '../../utils/format';
import { SALES_WIZARD_NEW_PATH } from '../../utils/routes';
import styles from './SalesWorkspacePage.module.css';

function CaseCard({
  card,
  onCompleteTask,
}: {
  card: SalesCaseCard;
  onCompleteTask?: () => void;
}) {
  void onCompleteTask;
  return (
    <article className={card.isOverdue ? `${styles.card} ${styles.cardOverdue}` : styles.card}>
      <div className={styles.actions}>
        <span className={styles.badge}>{card.phaseLabel}</span>
        {card.isOverdue ? <span className={`${styles.badge} ${styles.badgeUrgent}`}>Überfällig</span> : null}
        {card.staleCalculation ? <span className={styles.badge}>Berechnung veraltet</span> : null}
      </div>
      <h3 className={styles.cardTitle}>{card.companyName}</h3>
      <p className={styles.cardMeta}>{card.contactName}</p>
      {card.nextTaskTitle ? (
        <p className={styles.cardMeta}>
          Nächste Aufgabe: {card.nextTaskTitle}
          {card.nextTaskDueAt ? ` · fällig ${formatDateTime(card.nextTaskDueAt)}` : ''}
        </p>
      ) : null}
      {card.offerNumber ? <p className={styles.cardMeta}>Angebot {card.offerNumber}</p> : null}
      {card.lastActivityAt ? (
        <p className={styles.cardMeta}>Letzte Aktivität: {formatDateTime(card.lastActivityAt)}</p>
      ) : null}
      <div className={styles.actions}>
        {card.nextActionHref ? (
          <Link className={styles.primaryAction} to={card.nextActionHref}>
            {card.nextActionLabel}
          </Link>
        ) : null}
        {card.leadId ? (
          <Link className={styles.secondaryAction} to={`/leads/${card.leadId}`}>
            Lead öffnen
          </Link>
        ) : null}
        {card.sessionId ? (
          <Link
            className={styles.secondaryAction}
            to={
              card.wizardStep
                ? `/sales/wizard?session=${card.sessionId}`
                : `/calculator/bestpay?session=${card.sessionId}`
            }
          >
            Berechnung
          </Link>
        ) : null}
        {card.offerId ? (
          <Link className={styles.secondaryAction} to={`/offers/${card.offerId}`}>
            Angebot
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function SalesWorkspacePage() {
  const { currentUser } = useCurrentUser();
  const {
    salesWorkspaceService,
    salesTaskService,
    salesActivityService,
  } = useServices();
  const { showToast } = useToast();

  const [view, setView] = useState<SalesWorkspaceView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const [query, setQuery] = useState('');
  const [mobilePhase, setMobilePhase] = useState<SalesPipelinePhase>('new');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<SalesTaskType>('general');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteType, setNoteType] = useState<SalesActivityType>('note');

  const userContext = useMemo(
    () =>
      currentUser
        ? { userId: currentUser.id, role: currentUser.role, displayName: currentUser.name }
        : null,
    [currentUser],
  );

  const reload = useCallback(async () => {
    if (!userContext) {
      return;
    }
    setIsLoading(true);
    const next = await salesWorkspaceService.getWorkspaceView(userContext, {
      scope,
      query,
    });
    setView(next);
    setIsLoading(false);
  }, [query, salesWorkspaceService, scope, userContext]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!currentUser || !userContext) {
    return <EmptyState title="Kein Benutzer" description="Bitte melden Sie sich an." />;
  }

  const handleCreateTask = async () => {
    const result = await salesTaskService.createTask(
      {
        title: taskTitle,
        type: taskType,
        dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null,
        priority: 'normal',
      },
      userContext,
    );
    if (!result.ok) {
      showToast(result.message ?? 'Aufgabe konnte nicht angelegt werden', 'error');
      return;
    }
    setTaskTitle('');
    setShowTaskForm(false);
    showToast('Aufgabe angelegt', 'success');
    await reload();
  };

  const handleCreateNote = async () => {
    const result = await salesActivityService.createManualActivity(
      {
        type: noteType,
        title: noteTitle || SALES_ACTIVITY_TYPE_LABELS[noteType],
        description: noteBody,
      },
      userContext,
    );
    if (!result.ok) {
      showToast(result.message ?? 'Notiz konnte nicht gespeichert werden', 'error');
      return;
    }
    setNoteTitle('');
    setNoteBody('');
    setShowNoteForm(false);
    showToast('Aktivität gespeichert', 'success');
    await reload();
  };

  const handleCompleteTask = async (taskId: string) => {
    const result = await salesTaskService.completeTask(taskId, userContext);
    if (!result.ok) {
      showToast('Aufgabe konnte nicht erledigt werden', 'error');
      return;
    }
    showToast('Aufgabe erledigt', 'success');
    await reload();
  };

  const metrics = view?.metrics;

  return (
    <section>
      <PageHeader
        title="Arbeitsplatz"
        subtitle="Offene Vorgänge und nächste Schritte – Einstieg über den Kunden."
        actions={
          <div className={styles.headerActions}>
            <Link className={styles.primaryAction} to="/leads/new">
              Neuer Kunde
            </Link>
            <Link className={styles.secondaryAction} to={SALES_WIZARD_NEW_PATH}>
              Beratung starten
            </Link>
            <button
              type="button"
              className={styles.buttonAction}
              onClick={() => setShowTaskForm((value) => !value)}
            >
              Aufgabe anlegen
            </button>
          </div>
        }
      />

      <p className={styles.intro}>
        Ihr Tagesüberblick. Beratung, Angebot und Onboarding öffnen Sie vom jeweiligen Kunden aus.
      </p>

      <div className={styles.toolbar}>
        <SearchField
          label="Arbeitsplatz durchsuchen"
          value={query}
          onChange={setQuery}
          placeholder="Firma, Lead, Angebot, Aufgabe…"
        />
        {view?.canUseTeamScope ? (
          <FormField label="Sicht" id="sales-scope">
            <select
              id="sales-scope"
              value={scope}
              onChange={(event) => setScope(event.target.value as 'mine' | 'team')}
            >
              <option value="mine">Meine Vorgänge</option>
              <option value="team">Team</option>
            </select>
          </FormField>
        ) : (
          <p className={styles.muted}>Sicht: Meine Vorgänge</p>
        )}
        <button type="button" className={styles.buttonAction} onClick={() => setShowNoteForm((v) => !v)}>
          Notiz / Aktivität
        </button>
      </div>

      {showTaskForm ? (
        <div className={styles.dialog}>
          <h2 className={styles.sectionTitle}>Aufgabe anlegen</h2>
          <div className={styles.formGrid}>
            <FormField label="Titel" id="task-title">
              <input id="task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            </FormField>
            <FormField label="Typ" id="task-type">
              <select
                id="task-type"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as SalesTaskType)}
              >
                {Object.entries(SALES_TASK_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Fällig am" id="task-due">
              <input
                id="task-due"
                type="date"
                value={taskDueAt}
                onChange={(e) => setTaskDueAt(e.target.value)}
              />
            </FormField>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryAction} onClick={() => void handleCreateTask()}>
              Speichern
            </button>
            <button type="button" className={styles.buttonAction} onClick={() => setShowTaskForm(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : null}

      {showNoteForm ? (
        <div className={styles.dialog}>
          <h2 className={styles.sectionTitle}>Aktivität / Notiz</h2>
          <div className={styles.formGrid}>
            <FormField label="Typ" id="note-type">
              <select
                id="note-type"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as SalesActivityType)}
              >
                {(['note', 'call', 'email', 'meeting'] as const).map((value) => (
                  <option key={value} value={value}>
                    {SALES_ACTIVITY_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Titel" id="note-title">
              <input id="note-title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Beschreibung" id="note-body">
            <textarea
              id="note-body"
              className={styles.textarea}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
          </FormField>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryAction} onClick={() => void handleCreateNote()}>
              Speichern
            </button>
            <button type="button" className={styles.buttonAction} onClick={() => setShowNoteForm(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : null}

      {isLoading || !view || !metrics ? (
        <EmptyState
          title="Arbeitsplatz wird geladen"
          description="Kennzahlen und offene Vorgänge werden vorbereitet."
        />
      ) : (
        <>
          <section className={styles.section} aria-labelledby="metrics-heading">
            <h2 id="metrics-heading" className={styles.sectionTitle}>
              Kennzahlen
            </h2>
            <div className={styles.metrics}>
              {(
                [
                  ['Überfällig', metrics.overdueTasks],
                  ['Heute fällig', metrics.todayTasks],
                  ['Offene Kunden', metrics.openLeads],
                  ['Beratungen offen', metrics.openWizardSessions],
                  ['Vergleiche offen', metrics.openCalculations],
                  ['In Freigabe', metrics.offersInApproval],
                  ['Nachfassen', metrics.openFollowUps],
                  ['Erwartete Abschlüsse', metrics.expectedClosings],
                ] as const
              ).map(([label, value]) => (
                <article key={label} className={styles.metricCard}>
                  <p className={styles.metricValue}>{value}</p>
                  <p className={styles.metricLabel}>{label}</p>
                </article>
              ))}
            </div>
          </section>

          {view.searchHits.length > 0 ? (
            <section className={styles.section} aria-labelledby="search-heading">
              <h2 id="search-heading" className={styles.sectionTitle}>
                Suchtreffer
              </h2>
              <ul className={styles.list}>
                {view.searchHits.map((hit) => (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <Link className={styles.secondaryAction} to={hit.href}>
                      {hit.title} – {hit.subtitle}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={styles.section} aria-labelledby="today-heading">
            <h2 id="today-heading" className={styles.sectionTitle}>
              Heute
            </h2>
            {view.overdueTasks.length === 0 && view.todayTasks.length === 0 ? (
              <EmptyState
                title="Keine Aufgaben für heute"
                description="Überfällige und heute fällige Aufgaben erscheinen hier."
              />
            ) : (
              <ul className={styles.list}>
                {[...view.overdueTasks, ...view.todayTasks].map((task) => (
                  <li key={task.id}>
                    <article className={styles.taskCard}>
                      <div className={styles.actions}>
                        <span className={styles.badge}>{SALES_TASK_TYPE_LABELS[task.type]}</span>
                        <span className={styles.badge}>
                          {SALES_TASK_PRIORITY_LABELS[task.priority]}
                        </span>
                        {salesTaskService.isOverdue(task) ? (
                          <span className={`${styles.badge} ${styles.badgeUrgent}`}>Überfällig</span>
                        ) : null}
                      </div>
                      <h3 className={styles.cardTitle}>{task.title}</h3>
                      <p className={styles.cardMeta}>
                        {task.dueAt ? `Fällig: ${formatDateTime(task.dueAt)}` : 'Ohne Termin'}
                      </p>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.primaryAction}
                          onClick={() => void handleCompleteTask(task.id)}
                        >
                          Erledigen
                        </button>
                        {task.leadId ? (
                          <Link className={styles.secondaryAction} to={`/leads/${task.leadId}`}>
                            Lead
                          </Link>
                        ) : null}
                        {task.offerId ? (
                          <Link className={styles.secondaryAction} to={`/offers/${task.offerId}`}>
                            Angebot
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="pipeline-heading">
            <h2 id="pipeline-heading" className={styles.sectionTitle}>
              Pipeline
            </h2>
            <p className={styles.sectionHint}>
              Phasen werden aus Lead, Berechnung, Angebot und Provision abgeleitet – ohne den
              Offerstatus zu überschreiben.
            </p>

            <div className={styles.pipelineMobile}>
              <FormField label="Phase" id="mobile-phase">
                <select
                  id="mobile-phase"
                  value={mobilePhase}
                  onChange={(event) => setMobilePhase(event.target.value as SalesPipelinePhase)}
                >
                  {SALES_PIPELINE_PHASES.map((phase) => (
                    <option key={phase} value={phase}>
                      {SALES_PIPELINE_PHASE_LABELS[phase]} ({view.pipeline[phase].length})
                    </option>
                  ))}
                </select>
              </FormField>
              {view.pipeline[mobilePhase].length === 0 ? (
                <EmptyState
                  title="Keine Fälle in dieser Phase"
                  description="Wechseln Sie die Phase oder starten Sie eine Beratung über den Kunden."
                />
              ) : (
                <ul className={styles.list}>
                  {view.pipeline[mobilePhase].map((card) => (
                    <li key={card.id}>
                      <CaseCard card={card} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.pipelineDesktop}>
              <div className={styles.pipelineColumns}>
                {SALES_PIPELINE_PHASES.map((phase) => (
                  <section key={phase} className={styles.pipelineColumn} aria-label={SALES_PIPELINE_PHASE_LABELS[phase]}>
                    <h3 className={styles.pipelineColumnTitle}>
                      {SALES_PIPELINE_PHASE_LABELS[phase]} ({view.pipeline[phase].length})
                    </h3>
                    <ul className={styles.list}>
                      {view.pipeline[phase].slice(0, 8).map((card) => (
                        <li key={card.id}>
                          <CaseCard card={card} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </section>

          {view.unassignedSessions.length > 0 ? (
            <section className={styles.section} aria-labelledby="unassigned-heading">
              <h2 id="unassigned-heading" className={styles.sectionTitle}>
                Noch nicht zugeordnet
              </h2>
              <ul className={styles.list}>
                {view.unassignedSessions.map((card) => (
                  <li key={card.id}>
                    <CaseCard card={card} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={styles.section} aria-labelledby="open-heading">
            <h2 id="open-heading" className={styles.sectionTitle}>
              Offene Vorgänge
            </h2>
            <ul className={styles.list}>
              <li className={styles.cardMeta}>
                Unvollständige Beratungen: {view.openItems.incompleteWizards.length}
              </li>
              <li className={styles.cardMeta}>
                Veraltete Berechnungen: {view.openItems.staleCalculations.length}
              </li>
              <li className={styles.cardMeta}>
                Angebote in Freigabe: {view.openItems.offersInApproval.length}
              </li>
              <li className={styles.cardMeta}>
                Versendet ohne Nachfassaufgabe: {view.openItems.sentWithoutFollowUp.length}
              </li>
            </ul>
          </section>

          <section className={styles.section} aria-labelledby="wizard-open-heading">
            <h2 id="wizard-open-heading" className={styles.sectionTitle}>
              Laufende Vorgänge
            </h2>
            {view.openItems.incompleteWizards.length === 0 ? (
              <EmptyState
                title="Keine laufenden Vorgänge"
                description="Starten Sie eine Beratung über den Kunden oder „Beratung starten“."
              />
            ) : (
              <ul className={styles.list}>
                {view.openItems.incompleteWizards.slice(0, 20).map((session) => (
                  <li key={session.id}>
                    <Link
                      className={styles.secondaryAction}
                      to={`/sales/wizard?session=${session.id}`}
                    >
                      Vorgang fortsetzen:{' '}
                      {session.customerLabel || session.title || session.id}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="closing-heading">
            <h2 id="closing-heading" className={styles.sectionTitle}>
              Erwartete Abschlüsse
            </h2>
            {view.expectedClosings.acceptedOffers.length === 0 &&
            view.expectedClosings.activationOffers.length === 0 ? (
              <EmptyState
                title="Keine erwarteten Abschlüsse"
                description="Angenommene Angebote und Aktivierungen erscheinen hier."
              />
            ) : (
              <ul className={styles.list}>
                {view.expectedClosings.acceptedOffers.map((offer) => (
                  <li key={offer.id}>
                    <Link className={styles.secondaryAction} to={`/offers/${offer.id}`}>
                      Angenommen: {offer.offerNumber}
                    </Link>
                  </li>
                ))}
                {view.expectedClosings.activationOffers.map((offer) => (
                  <li key={offer.id}>
                    <Link className={styles.secondaryAction} to={`/offers/${offer.id}`}>
                      Aktivierung: {offer.offerNumber}
                    </Link>
                  </li>
                ))}
                {salesWorkspaceService.canSeeCommission(userContext)
                  ? view.expectedClosings.unpaidCommissionOfferIds.slice(0, 5).map((offerId) => (
                      <li key={`comm-${offerId}`}>
                        <Link className={styles.secondaryAction} to={`/offers/${offerId}`}>
                          Provision offen: {offerId}
                        </Link>
                      </li>
                    ))
                  : null}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className={styles.sectionTitle}>
              Aktivitäten
            </h2>
            {view.timeline.length === 0 ? (
              <EmptyState
                title="Noch keine Aktivitäten"
                description="Notizen, Telefonate und Systemereignisse erscheinen chronologisch."
              />
            ) : (
              <ul className={styles.list}>
                {view.timeline.map((activity) => (
                  <li key={activity.id}>
                    <article className={styles.timelineItem}>
                      <div className={styles.actions}>
                        <span className={styles.badge}>
                          {SALES_ACTIVITY_TYPE_LABELS[activity.type]}
                        </span>
                        {activity.isSystem ? <span className={styles.badge}>System</span> : null}
                      </div>
                      <h3 className={styles.cardTitle}>{activity.title}</h3>
                      <p className={styles.cardMeta}>{formatDateTime(activity.occurredAt)}</p>
                      {activity.description ? (
                        <p className={styles.cardMeta}>{activity.description}</p>
                      ) : null}
                      <div className={styles.actions}>
                        {activity.leadId ? (
                          <Link className={styles.secondaryAction} to={`/leads/${activity.leadId}`}>
                            Lead
                          </Link>
                        ) : null}
                        {activity.offerId ? (
                          <Link className={styles.secondaryAction} to={`/offers/${activity.offerId}`}>
                            Angebot
                          </Link>
                        ) : null}
                        {activity.comparisonSessionId ? (
                          <Link
                            className={styles.secondaryAction}
                            to={`/sales/wizard?session=${activity.comparisonSessionId}`}
                          >
                            Berechnung
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}
