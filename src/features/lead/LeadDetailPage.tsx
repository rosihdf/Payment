import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { FormControl } from '../../components/common/FormControl';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import type { ActivationListItem } from '../../domain/activation/activationCase';
import { ACTIVATION_STATUS_LABELS } from '../../domain/activation/activationStatus';
import type { Contact, ContactPreferredChannel } from '../../domain/contact/contact';
import { CONTACT_PREFERRED_CHANNEL_LABELS } from '../../domain/contact/contact';
import type { ContractListItem } from '../../domain/contract/contract';
import { CONTRACT_STATUS_LABELS } from '../../domain/contract/contractStatus';
import type { Lead } from '../../domain/lead/lead';
import { getLeadDisplayName, getSessionCustomerDisplayName } from '../../domain/lead/getLeadDisplayName';
import type { Offer } from '../../domain/offer/offer';
import { OFFER_WORKFLOW_STATUS_LABELS } from '../../domain/offer/offerWorkflow';
import type { CustomerDocumentRef } from '../../services/customerDocumentAggregationService';
import {
  CUSTOMER_STAND_LABELS,
  deriveCustomerPrimaryAction,
  deriveCustomerStand,
  pickLatestOffer,
  pickLatestSession,
} from '../../domain/salesWorkspace/customerRecordView';
import type { ManualSalesActivityType, SalesActivity } from '../../domain/salesWorkspace/salesActivity';
import { SALES_ACTIVITY_TYPE_LABELS } from '../../domain/salesWorkspace/salesActivity';
import type { SalesTask, SalesTaskPriority, SalesTaskType } from '../../domain/salesWorkspace/salesTask';
import {
  CRM_SALES_TASK_TYPES,
  SALES_TASK_PRIORITY_LABELS,
  SALES_TASK_STATUS_LABELS,
  SALES_TASK_TYPE_LABELS,
} from '../../domain/salesWorkspace/salesTask';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import type { User } from '../../domain/user/user';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import {
  displayDateTime,
  displayText,
  formatContactName,
  formatDate,
} from '../../utils/format';
import { ADVICE_NEW_PATH, salesWizardSessionPath } from '../../utils/routes';
import {
  dateInputToIsoEndOfDay,
  datetimeLocalToIso,
  formatLastCustomerContact,
  groupDocumentsByType,
  groupTimelineByRecency,
  lastCustomerContactForContact,
  latestCustomerContact,
  matchesCrmTimelineFilter,
  matchesTimelineSearch,
  timelineIconForActivity,
  toDateInputValue,
  toDatetimeLocalValue,
  type CrmTimelineFilter,
} from './customerRecordUi';
import styles from './LeadDetailPage.module.css';

type TabId =
  | 'overview'
  | 'contacts'
  | 'timeline'
  | 'tasks'
  | 'notes'
  | 'documents'
  | 'advice'
  | 'offer'
  | 'contract'
  | 'activation'
  | 'commission';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'contacts', label: 'Ansprechpartner' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'tasks', label: 'Aufgaben' },
  { id: 'notes', label: 'Notizen' },
  { id: 'documents', label: 'Dokumente' },
  { id: 'advice', label: 'Beratung' },
  { id: 'offer', label: 'Angebote' },
  { id: 'contract', label: 'Verträge' },
  { id: 'activation', label: 'Aktivierungen' },
  { id: 'commission', label: 'Provision' },
];

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function toUserContext(user: { id: string; role: User['role']; name: string; status: User['status'] }) {
  return {
    userId: user.id,
    role: user.role,
    displayName: user.name,
    status: user.status,
  };
}

function toOfferContext(user: { id: string; role: User['role']; name: string }) {
  return {
    userId: user.id,
    role: user.role,
    displayName: user.name,
  };
}

function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }
    return (
      left.lastName.localeCompare(right.lastName, 'de') ||
      left.firstName.localeCompare(right.firstName, 'de')
    );
  });
}

type ContactFormState = {
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  mobile: string;
  email: string;
  preferredChannel: ContactPreferredChannel;
  notes: string;
  isPrimary: boolean;
};

const emptyContactForm: ContactFormState = {
  firstName: '',
  lastName: '',
  role: '',
  phone: '',
  mobile: '',
  email: '',
  preferredChannel: '',
  notes: '',
  isPrimary: false,
};

type TaskFormState = {
  title: string;
  type: SalesTaskType;
  priority: SalesTaskPriority;
  dueDate: string;
  description: string;
  contactId: string;
};

const emptyTaskForm: TaskFormState = {
  title: '',
  type: 'other',
  priority: 'normal',
  dueDate: '',
  description: '',
  contactId: '',
};

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { currentUser } = useCurrentUser();
  const {
    leadService,
    userService,
    offerService,
    salesWorkspaceService,
    contractService,
    activationService,
    contactService,
    salesActivityService,
    salesTaskService,
    customerDocumentAggregationService,
  } = useServices();

  const [lead, setLead] = useState<Lead | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [activations, setActivations] = useState<ActivationListItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openTasks, setOpenTasks] = useState<SalesTask[]>([]);
  const [tasks, setTasks] = useState<SalesTask[]>([]);
  const [timeline, setTimeline] = useState<SalesActivity[]>([]);
  const [sessions, setSessions] = useState<BestPayComparisonSession[]>([]);
  const [documents, setDocuments] = useState<CustomerDocumentRef[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tab, setTab] = useState<TabId>('overview');
  const [timelineFilter, setTimelineFilter] = useState<CrmTimelineFilter>('all');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [contactForm, setContactForm] = useState<ContactFormState>(emptyContactForm);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [deactivateContactId, setDeactivateContactId] = useState<string | null>(null);

  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const [noteForm, setNoteForm] = useState({ title: '', description: '' });
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);

  const [activityForm, setActivityForm] = useState<{
    type: ManualSalesActivityType;
    title: string;
    description: string;
    contactId: string;
    occurredAtLocal: string;
    followUpEnabled: boolean;
    followUpTitle: string;
    followUpDueDate: string;
  }>({
    type: 'call',
    title: '',
    description: '',
    contactId: '',
    occurredAtLocal: '',
    followUpEnabled: false,
    followUpTitle: '',
    followUpDueDate: '',
  });
  const [showActivityForm, setShowActivityForm] = useState(false);

  const bumpReload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    void userService.getAllUsers().then(setUsers);
  }, [userService]);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void leadService.getLeadById(id).then((result) => {
      setLead(result);
      setIsLoading(false);
    });
  }, [id, leadService, location.key, reloadToken]);

  useEffect(() => {
    if (!id || !currentUser) {
      return;
    }
    const context = toUserContext(currentUser);
    const offerContext = toOfferContext(currentUser);

    void offerService.getOffersForLead(id, offerContext).then(setOffers);

    void contractService.list(context, { status: 'all' }).then((result) => {
      if (result.ok) {
        setContracts(result.value.filter((contract) => contract.leadId === id));
      }
    });

    void activationService.list(context, { status: 'all' }).then((result) => {
      if (result.ok) {
        setActivations(result.value.filter((activation) => activation.leadId === id));
      }
    });

    void salesWorkspaceService.getLeadWorkspaceSummary(id, offerContext).then((summary) => {
      if (!summary) {
        setOpenTasks([]);
        setSessions([]);
        return;
      }
      setOpenTasks(summary.openTasks);
      setSessions(summary.sessions);
    });

    void salesActivityService.getTimelineForLead(id, offerContext, { limit: 200 }).then(setTimeline);

    void salesTaskService.listVisible(offerContext).then((visible) => {
      setTasks(visible.filter((task) => task.leadId === id));
    });

    void customerDocumentAggregationService.listForLead(id).then(setDocuments);

    void contactService.ensurePrimaryFromLead(id, offerContext).then(async () => {
      const listed = await contactService.listByLead(id, offerContext, { includeInactive: true });
      if (listed.ok) {
        setContacts(sortContacts(listed.contacts));
      }
    });
  }, [
    activationService,
    contactService,
    contractService,
    currentUser,
    customerDocumentAggregationService,
    id,
    offerService,
    reloadToken,
    salesActivityService,
    salesTaskService,
    salesWorkspaceService,
    location.key,
  ]);

  const getUserName = (userId: string): string =>
    users.find((user) => user.id === userId)?.name ?? 'Nicht angegeben';

  const canEdit =
    lead && currentUser
      ? leadService.canUserEditLead(lead, {
          userId: currentUser.id,
          role: currentUser.role,
        })
      : false;

  const facts = useMemo(() => {
    if (!lead) return null;
    return {
      lead,
      sessions,
      offers,
      contracts: contracts.map((contract) => ({
        id: contract.id,
        contractNumber: contract.contractNumber,
        status: contract.status,
        startDate: contract.startDate,
        endDate: contract.endDate,
        tariffName: contract.tariffName,
      })),
      activations: activations.map((activation) => ({
        id: activation.id,
        activationNumber: activation.activationNumber,
        status: activation.status,
        progressPercent: activation.progressPercent,
        nextStep: activation.nextStep,
        openBlockerCount: activation.openBlockerCount,
        contractId: activation.contractId,
      })),
      openTasks,
    };
  }, [activations, contracts, lead, offers, openTasks, sessions]);

  const stand = facts ? deriveCustomerStand(facts) : 'new';
  const primary = facts
    ? deriveCustomerPrimaryAction(facts)
    : {
        label: 'Kein Handlungsbedarf',
        href: null,
        dueAt: null,
        warning: null,
        kind: 'none' as const,
      };
  const latestOffer = pickLatestOffer(offers);
  const latestSession = pickLatestSession(sessions);
  const latestContract = contracts[0] ?? null;
  const latestActivation = activations[0] ?? null;

  const filteredTimeline = useMemo(
    () =>
      timeline.filter(
        (activity) =>
          matchesCrmTimelineFilter(activity, timelineFilter) &&
          matchesTimelineSearch(activity, timelineSearch, contacts),
      ),
    [contacts, timeline, timelineFilter, timelineSearch],
  );
  const timelineGroups = useMemo(
    () => groupTimelineByRecency(filteredTimeline),
    [filteredTimeline],
  );
  const documentGroups = useMemo(() => groupDocumentsByType(documents), [documents]);
  const notes = useMemo(
    () => timeline.filter((activity) => activity.type === 'note'),
    [timeline],
  );
  const nextOpenTask = useMemo(() => {
    const open = tasks.filter((task) => task.status === 'open' || task.status === 'in_progress');
    return (
      [...open].sort((left, right) => {
        if (!left.dueAt && !right.dueAt) return 0;
        if (!left.dueAt) return 1;
        if (!right.dueAt) return -1;
        return left.dueAt.localeCompare(right.dueAt);
      })[0] ?? null
    );
  }, [tasks]);
  const taskCounts = useMemo(() => {
    const open = tasks.filter((task) => task.status === 'open' || task.status === 'in_progress');
    const overdue = open.filter((task) => salesTaskService.isOverdue(task));
    return {
      open: open.length,
      overdue: overdue.length,
      otherOpen: open.length - overdue.length,
    };
  }, [salesTaskService, tasks]);
  const lastCustomerContact = useMemo(() => latestCustomerContact(timeline), [timeline]);
  const recentTimeline = useMemo(() => timeline.slice(0, 5), [timeline]);
  const lastAdvice = useMemo(() => {
    const advice = timeline
      .filter((activity) => activity.type === 'advice_started' || activity.type === 'advice_completed')
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
    if (advice) {
      return advice;
    }
    return latestSession;
  }, [latestSession, timeline]);

  if (isLoading) {
    return (
      <section>
        <PageHeader title="Kundenakte" subtitle="Daten werden geladen…" />
        <EmptyState title="Kundenakte wird geladen" description="Die Kundendaten werden abgerufen." />
      </section>
    );
  }

  if (!lead || !id) {
    return (
      <section>
        <PageHeader title="Kundenakte nicht gefunden" />
        <EmptyState
          title="Kunde nicht gefunden"
          description="Der angeforderte Kundeneintrag existiert nicht."
          action={
            <Link className={styles.link} to="/leads">
              Zur Kundenliste
            </Link>
          }
        />
      </section>
    );
  }

  const contactName = formatContactName(lead.contactFirstName, lead.contactLastName);
  const beratungPath = latestSession
    ? salesWizardSessionPath(latestSession.id)
    : `${ADVICE_NEW_PATH}&leadId=${encodeURIComponent(lead.id)}`;
  const userContext = currentUser ? toOfferContext(currentUser) : null;

  const openContactCreate = () => {
    setEditingContactId(null);
    setContactForm({ ...emptyContactForm, isPrimary: contacts.length === 0 });
    setShowContactForm(true);
    setErrorMessage(null);
  };

  const openContactEdit = (contact: Contact) => {
    setEditingContactId(contact.id);
    setContactForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      role: contact.role,
      phone: contact.phone,
      mobile: contact.mobile,
      email: contact.email,
      preferredChannel: contact.preferredChannel,
      notes: contact.notes,
      isPrimary: contact.isPrimary,
    });
    setShowContactForm(true);
    setErrorMessage(null);
  };

  const saveContact = async () => {
    if (!userContext) return;
    setErrorMessage(null);
    if (editingContactId) {
      const result = await contactService.update(
        editingContactId,
        {
          firstName: contactForm.firstName,
          lastName: contactForm.lastName,
          role: contactForm.role,
          phone: contactForm.phone,
          mobile: contactForm.mobile,
          email: contactForm.email,
          preferredChannel: contactForm.preferredChannel,
          notes: contactForm.notes,
          isPrimary: contactForm.isPrimary,
        },
        userContext,
      );
      if (!result.ok) {
        setErrorMessage(result.message ?? 'Ansprechpartner konnte nicht gespeichert werden.');
        return;
      }
    } else {
      const result = await contactService.create(
        {
          leadId: lead.id,
          firstName: contactForm.firstName,
          lastName: contactForm.lastName,
          role: contactForm.role,
          phone: contactForm.phone,
          mobile: contactForm.mobile,
          email: contactForm.email,
          preferredChannel: contactForm.preferredChannel,
          notes: contactForm.notes,
          isPrimary: contactForm.isPrimary,
        },
        userContext,
      );
      if (!result.ok) {
        setErrorMessage(result.message ?? 'Ansprechpartner konnte nicht angelegt werden.');
        return;
      }
    }
    setShowContactForm(false);
    bumpReload();
  };

  const setPrimaryContact = async (contactId: string) => {
    if (!userContext) return;
    const result = await contactService.setPrimary(contactId, userContext);
    if (!result.ok) {
      setErrorMessage(result.message ?? 'Primärkontakt konnte nicht gesetzt werden.');
      return;
    }
    bumpReload();
  };

  const confirmDeactivateContact = async () => {
    if (!userContext || !deactivateContactId) return;
    const target = contacts.find((contact) => contact.id === deactivateContactId);
    if (target?.isPrimary) {
      const successor = contacts.find(
        (contact) => contact.id !== deactivateContactId && contact.isActive,
      );
      if (!successor) {
        setDeactivateContactId(null);
        setErrorMessage('Der letzte aktive Primärkontakt kann nicht deaktiviert werden.');
        return;
      }
      const promoted = await contactService.setPrimary(successor.id, userContext);
      if (!promoted.ok) {
        setDeactivateContactId(null);
        setErrorMessage(promoted.message ?? 'Deaktivierung nicht möglich.');
        return;
      }
    }
    const result = await contactService.update(
      deactivateContactId,
      { isActive: false },
      userContext,
    );
    setDeactivateContactId(null);
    if (!result.ok) {
      setErrorMessage(result.message ?? 'Deaktivierung nicht möglich.');
      return;
    }
    bumpReload();
  };

  const openTaskCreate = () => {
    setEditingTaskId(null);
    setTaskForm(emptyTaskForm);
    setShowTaskForm(true);
    setErrorMessage(null);
  };

  const openTaskEdit = (task: SalesTask) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      type: task.type,
      priority: task.priority,
      dueDate: toDateInputValue(task.dueAt),
      description: task.description,
      contactId: task.contactId ?? '',
    });
    setShowTaskForm(true);
    setErrorMessage(null);
  };

  const saveTask = async () => {
    if (!userContext) return;
    setErrorMessage(null);
    const dueAt = dateInputToIsoEndOfDay(taskForm.dueDate);
    const contactId = taskForm.contactId || null;
    if (editingTaskId) {
      const result = await salesTaskService.updateTask(
        editingTaskId,
        {
          title: taskForm.title,
          type: taskForm.type,
          priority: taskForm.priority,
          dueAt,
          description: taskForm.description,
          contactId,
        },
        userContext,
      );
      if (!result.ok) {
        setErrorMessage(result.message ?? 'Aufgabe konnte nicht gespeichert werden.');
        return;
      }
    } else {
      const result = await salesTaskService.createTask(
        {
          title: taskForm.title,
          type: taskForm.type,
          priority: taskForm.priority,
          dueAt,
          description: taskForm.description,
          leadId: lead.id,
          contactId,
        },
        userContext,
      );
      if (!result.ok) {
        setErrorMessage(result.message ?? 'Aufgabe konnte nicht angelegt werden.');
        return;
      }
    }
    setShowTaskForm(false);
    bumpReload();
  };

  const completeTask = async (taskId: string) => {
    if (!userContext) return;
    const result = await salesTaskService.completeTask(taskId, userContext);
    if (!result.ok) {
      setErrorMessage('Aufgabe konnte nicht erledigt werden.');
      return;
    }
    bumpReload();
  };

  const cancelTask = async (taskId: string) => {
    if (!userContext) return;
    const result = await salesTaskService.cancelTask(taskId, userContext);
    if (!result.ok) {
      setErrorMessage('Aufgabe konnte nicht abgebrochen werden.');
      return;
    }
    bumpReload();
  };

  const openQuickActivity = (type: 'call' | 'visit' | 'note') => {
    setShowTaskForm(false);
    setShowNoteForm(false);
    setShowActivityForm(false);
    setErrorMessage(null);
    if (type === 'note') {
      if (tab !== 'overview' && tab !== 'timeline') {
        setTab('timeline');
      }
      setEditingNoteId(null);
      setNoteForm({ title: '', description: '' });
      setShowNoteForm(true);
      return;
    }
    const primary = contacts.find((contact) => contact.isPrimary && contact.isActive);
    setActivityForm({
      type,
      title: type === 'call' ? 'Telefonat' : 'Besuch',
      description: '',
      contactId: primary?.id ?? '',
      occurredAtLocal: toDatetimeLocalValue(new Date().toISOString()),
      followUpEnabled: false,
      followUpTitle: '',
      followUpDueDate: '',
    });
    setShowActivityForm(true);
  };

  const openQuickTask = () => {
    setShowActivityForm(false);
    setShowNoteForm(false);
    if (tab !== 'overview' && tab !== 'timeline' && tab !== 'tasks') {
      setTab('tasks');
    }
    openTaskCreate();
  };

  const saveActivity = async () => {
    if (!userContext) return;
    setErrorMessage(null);
    const occurredAt = datetimeLocalToIso(activityForm.occurredAtLocal) ?? undefined;
    const result = await salesActivityService.createManualActivity(
      {
        type: activityForm.type,
        title: activityForm.title,
        description: activityForm.description,
        leadId: lead.id,
        contactId: activityForm.contactId || null,
        occurredAt,
      },
      userContext,
    );
    if (!result.ok) {
      setErrorMessage(result.message ?? 'Aktivität konnte nicht gespeichert werden.');
      return;
    }
    if (activityForm.followUpEnabled && activityForm.followUpTitle.trim()) {
      const followUp = await salesTaskService.createTask(
        {
          title: activityForm.followUpTitle.trim(),
          type: activityForm.type === 'visit' ? 'visit' : 'phone',
          priority: 'normal',
          dueAt: dateInputToIsoEndOfDay(activityForm.followUpDueDate),
          leadId: lead.id,
          contactId: activityForm.contactId || null,
        },
        userContext,
      );
      if (!followUp.ok) {
        setErrorMessage(followUp.message ?? 'Aktivität gespeichert, Wiedervorlage fehlgeschlagen.');
      }
    }
    setShowActivityForm(false);
    bumpReload();
  };

  const renderQuickActions = () =>
    canEdit ? (
      <div className={styles.quickActions} role="group" aria-label="Schnellaktionen">
        <button
          type="button"
          className={styles.primaryAction}
          onClick={() => openQuickActivity('call')}
        >
          + Telefonat
        </button>
        <button
          type="button"
          className={styles.primaryAction}
          onClick={() => openQuickActivity('visit')}
        >
          + Besuch
        </button>
        <button
          type="button"
          className={styles.primaryAction}
          onClick={() => openQuickActivity('note')}
        >
          + Notiz
        </button>
        <button type="button" className={styles.primaryAction} onClick={openQuickTask}>
          + Aufgabe
        </button>
      </div>
    ) : null;

  const renderActivityForm = () =>
    showActivityForm ? (
      <div className={styles.formPanel}>
        <FormControl
          type="text"
          label="Titel"
          required
          value={activityForm.title}
          onChange={(event) =>
            setActivityForm((prev) => ({ ...prev, title: event.target.value }))
          }
        />
        <FormControl
          type="datetime-local"
          label="Zeitpunkt"
          value={activityForm.occurredAtLocal}
          onChange={(event) =>
            setActivityForm((prev) => ({ ...prev, occurredAtLocal: event.target.value }))
          }
        />
        <FormControl
          type="text"
          label="Ergebnis / Kurznotiz"
          value={activityForm.description}
          onChange={(event) =>
            setActivityForm((prev) => ({ ...prev, description: event.target.value }))
          }
        />
        <FormControl
          type="select"
          label="Ansprechpartner"
          value={activityForm.contactId}
          onChange={(event) =>
            setActivityForm((prev) => ({ ...prev, contactId: event.target.value }))
          }
          options={[
            { value: '', label: 'Kein Ansprechpartner' },
            ...contacts
              .filter((contact) => contact.isActive)
              .map((contact) => ({
                value: contact.id,
                label: formatContactName(contact.firstName, contact.lastName),
              })),
          ]}
        />
        <FormControl
          type="select"
          label="Wiedervorlage anlegen"
          value={activityForm.followUpEnabled ? 'yes' : 'no'}
          onChange={(event) =>
            setActivityForm((prev) => ({
              ...prev,
              followUpEnabled: event.target.value === 'yes',
            }))
          }
          options={[
            { value: 'no', label: 'Nein' },
            { value: 'yes', label: 'Ja' },
          ]}
        />
        {activityForm.followUpEnabled ? (
          <>
            <FormControl
              type="text"
              label="Aufgabe"
              required
              value={activityForm.followUpTitle}
              onChange={(event) =>
                setActivityForm((prev) => ({ ...prev, followUpTitle: event.target.value }))
              }
            />
            <FormControl
              type="date"
              label="Fällig"
              value={activityForm.followUpDueDate}
              onChange={(event) =>
                setActivityForm((prev) => ({ ...prev, followUpDueDate: event.target.value }))
              }
            />
          </>
        ) : null}
        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => void saveActivity()}
          >
            Speichern
          </button>
          <button
            type="button"
            className={styles.editLink}
            onClick={() => setShowActivityForm(false)}
          >
            Abbrechen
          </button>
        </div>
      </div>
    ) : null;

  const openNoteCreate = () => {
    setEditingNoteId(null);
    setNoteForm({ title: '', description: '' });
    setShowNoteForm(true);
    setErrorMessage(null);
  };

  const openNoteEdit = (note: SalesActivity) => {
    if (!note.editable || note.isSystem) return;
    setEditingNoteId(note.id);
    setNoteForm({ title: note.title, description: note.description });
    setShowNoteForm(true);
    setErrorMessage(null);
  };

  const saveNote = async () => {
    if (!userContext) return;
    setErrorMessage(null);
    if (editingNoteId) {
      const result = await salesActivityService.updateManualActivity(
        editingNoteId,
        { title: noteForm.title, description: noteForm.description },
        userContext,
      );
      if (!result.ok) {
        setErrorMessage(result.message ?? 'Notiz konnte nicht gespeichert werden.');
        return;
      }
    } else {
      const result = await salesActivityService.createManualActivity(
        {
          type: 'note',
          title: noteForm.title,
          description: noteForm.description,
          leadId: lead.id,
        },
        userContext,
      );
      if (!result.ok) {
        setErrorMessage(result.message ?? 'Notiz konnte nicht angelegt werden.');
        return;
      }
    }
    setShowNoteForm(false);
    bumpReload();
  };

  const documentDownloadHref = (document: CustomerDocumentRef): string | null => {
    if (document.source === 'offer_document' && document.offerId) {
      return `/offers/${document.offerId}/documents/${document.id}`;
    }
    if (document.offerId) {
      return `/offers/${document.offerId}`;
    }
    if (document.contractId) {
      return `/contracts/${document.contractId}`;
    }
    if (document.activationId) {
      return `/activations/${document.activationId}`;
    }
    return null;
  };

  return (
    <section>
      <PageHeader
        title={getLeadDisplayName(lead)}
        subtitle="Kundenakte"
        actions={
          <div className={styles.headerActions}>
            {canEdit ? (
              <Link className={styles.editLink} to={`/leads/${lead.id}/edit`}>
                Bearbeiten
              </Link>
            ) : null}
            <Link className={styles.link} to="/leads">
              Zur Übersicht
            </Link>
          </div>
        }
      />

      <section className={styles.hero} aria-labelledby="customer-record-summary">
        <h2 id="customer-record-summary" className={styles.visuallyHidden}>
          Zusammenfassung
        </h2>
        <dl className={styles.heroGrid}>
          <DetailRow label="Ansprechpartner" value={displayText(contactName)} />
          <DetailRow label="Telefon" value={displayText(lead.phone)} />
          <DetailRow label="E-Mail" value={displayText(lead.email)} />
          <DetailRow label="Außendienst" value={getUserName(lead.assignedSalesUserId)} />
          <DetailRow label="Aktueller Stand" value={CUSTOMER_STAND_LABELS[stand]} />
          <DetailRow
            label="Fälligkeit"
            value={primary.dueAt ? displayDateTime(primary.dueAt) : '–'}
          />
        </dl>
        {primary.warning ? <p className={styles.warning}>{primary.warning}</p> : null}
        <div className={styles.heroActions}>
          {primary.href ? (
            <Link className={styles.primaryAction} to={primary.href}>
              {primary.label}
            </Link>
          ) : (
            <span className={styles.primaryIdle}>{primary.label}</span>
          )}
          {primary.href !== beratungPath ? (
            <Link className={styles.editLink} to={beratungPath}>
              Beratung
            </Link>
          ) : null}
          {latestOffer && primary.href !== `/offers/${latestOffer.id}` ? (
            <Link className={styles.editLink} to={`/offers/${latestOffer.id}`}>
              Angebot
            </Link>
          ) : null}
        </div>
      </section>

      {errorMessage ? <p className={styles.warning}>{errorMessage}</p> : null}

      <nav className={styles.tabs} aria-label="Kundenakte Bereiche">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={tab === entry.id ? styles.tabActive : styles.tab}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Übersicht</h2>
          {renderQuickActions()}
          {renderActivityForm()}
          {showNoteForm ? (
            <div className={styles.formPanel}>
              <FormControl
                type="text"
                label="Titel"
                required
                value={noteForm.title}
                onChange={(event) => setNoteForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <FormControl
                type="text"
                label="Inhalt"
                value={noteForm.description}
                onChange={(event) =>
                  setNoteForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <div className={styles.heroActions}>
                <button type="button" className={styles.primaryAction} onClick={() => void saveNote()}>
                  Speichern
                </button>
                <button type="button" className={styles.editLink} onClick={() => setShowNoteForm(false)}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}
          <dl className={styles.grid}>
            <DetailRow label="Aktueller Gesamtstand" value={CUSTOMER_STAND_LABELS[stand]} />
            <DetailRow label="Hauptaktion" value={primary.label} />
            <DetailRow
              label="Letzter Kundenkontakt"
              value={formatLastCustomerContact(lastCustomerContact, displayDateTime)}
            />
            <DetailRow
              label="Nächste Aufgabe"
              value={
                nextOpenTask
                  ? `${nextOpenTask.title}${
                      nextOpenTask.dueAt ? ` · ${formatDate(nextOpenTask.dueAt)}` : ''
                    }`
                  : 'Keine'
              }
            />
            <DetailRow label="Überfällige Aufgaben" value={String(taskCounts.overdue)} />
            <DetailRow label="Weitere offene Aufgaben" value={String(taskCounts.otherOpen)} />
            <DetailRow
              label="Letzte Beratung"
              value={
                lastAdvice && 'occurredAt' in lastAdvice
                  ? `${formatDate(lastAdvice.occurredAt)} · ${lastAdvice.title}`
                  : latestSession
                    ? displayDateTime(latestSession.updatedAt)
                    : 'Keine Beratung'
              }
            />
            <DetailRow
              label="Aktuelles Angebot"
              value={
                latestOffer
                  ? `${latestOffer.offerNumber} · ${OFFER_WORKFLOW_STATUS_LABELS[latestOffer.workflowStatus]}`
                  : 'Kein Angebot'
              }
            />
            <DetailRow
              label="Aktueller Vertrag"
              value={
                latestContract
                  ? `${latestContract.contractNumber} · ${CONTRACT_STATUS_LABELS[latestContract.status]}`
                  : 'Kein Vertrag'
              }
            />
            <DetailRow
              label="Aktivierung"
              value={
                latestActivation
                  ? `${latestActivation.activationNumber} · ${ACTIVATION_STATUS_LABELS[latestActivation.status]}`
                  : 'Nicht gestartet'
              }
            />
          </dl>
          {recentTimeline.length > 0 ? (
            <>
              <h3 className={styles.sectionTitle}>Letzte Timeline-Einträge</h3>
              <ul className={styles.offerList}>
                {recentTimeline.map((activity) => (
                  <li key={activity.id} className={styles.emptyHint}>
                    <span aria-hidden="true">{timelineIconForActivity(activity.type)} </span>
                    {displayDateTime(activity.occurredAt)} · {activity.title}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      {tab === 'contacts' ? (
        <section className={styles.detailSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Ansprechpartner</h2>
            {canEdit ? (
              <button type="button" className={styles.primaryAction} onClick={openContactCreate}>
                Neu
              </button>
            ) : null}
          </div>

          {showContactForm ? (
            <div className={styles.formPanel}>
              <FormControl
                type="text"
                label="Vorname"
                required
                value={contactForm.firstName}
                onChange={(event) =>
                  setContactForm((prev) => ({ ...prev, firstName: event.target.value }))
                }
              />
              <FormControl
                type="text"
                label="Nachname"
                required
                value={contactForm.lastName}
                onChange={(event) =>
                  setContactForm((prev) => ({ ...prev, lastName: event.target.value }))
                }
              />
              <FormControl
                type="text"
                label="Funktion"
                value={contactForm.role}
                onChange={(event) =>
                  setContactForm((prev) => ({ ...prev, role: event.target.value }))
                }
              />
              <FormControl
                type="text"
                label="Telefon"
                value={contactForm.phone}
                onChange={(event) =>
                  setContactForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
              <FormControl
                type="text"
                label="Mobil"
                value={contactForm.mobile}
                onChange={(event) =>
                  setContactForm((prev) => ({ ...prev, mobile: event.target.value }))
                }
              />
              <FormControl
                type="email"
                label="E-Mail"
                value={contactForm.email}
                onChange={(event) =>
                  setContactForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
              <FormControl
                type="select"
                label="Bevorzugter Kontaktweg"
                value={contactForm.preferredChannel}
                onChange={(event) =>
                  setContactForm((prev) => ({
                    ...prev,
                    preferredChannel: event.target.value as ContactPreferredChannel,
                  }))
                }
                options={[
                  { value: '', label: 'Nicht festgelegt' },
                  { value: 'phone', label: 'Telefon' },
                  { value: 'mobile', label: 'Mobil' },
                  { value: 'email', label: 'E-Mail' },
                ]}
              />
              <FormControl
                type="text"
                label="Notiz"
                value={contactForm.notes}
                onChange={(event) =>
                  setContactForm((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
              <FormControl
                type="select"
                label="Primärkontakt"
                value={contactForm.isPrimary ? 'yes' : 'no'}
                onChange={(event) =>
                  setContactForm((prev) => ({ ...prev, isPrimary: event.target.value === 'yes' }))
                }
                options={[
                  { value: 'no', label: 'Nein' },
                  { value: 'yes', label: 'Ja' },
                ]}
              />
              <div className={styles.heroActions}>
                <button type="button" className={styles.primaryAction} onClick={() => void saveContact()}>
                  Speichern
                </button>
                <button
                  type="button"
                  className={styles.editLink}
                  onClick={() => setShowContactForm(false)}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}

          {contacts.length === 0 ? (
            <p className={styles.emptyHint}>Noch keine Ansprechpartner.</p>
          ) : (
            <ul className={styles.offerList}>
              {contacts.map((contact) => {
                const lastContact = lastCustomerContactForContact(contact.id, timeline);
                return (
                  <li key={contact.id} className={styles.offerCard}>
                    <div className={styles.offerCardHeader}>
                      <span className={styles.offerTitle}>
                        {formatContactName(contact.firstName, contact.lastName)}
                        {contact.isPrimary ? ' · Primärkontakt' : ''}
                      </span>
                      <span className={styles.offerStatus}>
                        {contact.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    <dl className={styles.grid}>
                      <DetailRow label="Funktion" value={displayText(contact.role)} />
                      <DetailRow label="Telefon" value={displayText(contact.phone)} />
                      <DetailRow label="Mobil" value={displayText(contact.mobile)} />
                      <DetailRow label="E-Mail" value={displayText(contact.email)} />
                      <DetailRow
                        label="Bevorzugter Kontaktweg"
                        value={
                          contact.preferredChannel
                            ? CONTACT_PREFERRED_CHANNEL_LABELS[contact.preferredChannel]
                            : 'Nicht festgelegt'
                        }
                      />
                      <DetailRow
                        label="Letzter Kontakt"
                        value={formatLastCustomerContact(lastContact, displayDateTime)}
                      />
                    </dl>
                    {canEdit ? (
                      <div className={styles.heroActions}>
                        <button
                          type="button"
                          className={styles.editLink}
                          onClick={() => openContactEdit(contact)}
                        >
                          Bearbeiten
                        </button>
                        {!contact.isPrimary && contact.isActive ? (
                          <button
                            type="button"
                            className={styles.editLink}
                            onClick={() => void setPrimaryContact(contact.id)}
                          >
                            Primär setzen
                          </button>
                        ) : null}
                        {contact.isActive ? (
                          <button
                            type="button"
                            className={styles.editLink}
                            onClick={() => setDeactivateContactId(contact.id)}
                          >
                            Deaktivieren
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'timeline' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Timeline</h2>
          {renderQuickActions()}
          {renderActivityForm()}

          {showNoteForm && (tab === 'timeline' || tab === 'overview') ? (
            <div className={styles.formPanel}>
              <FormControl
                type="text"
                label="Titel"
                required
                value={noteForm.title}
                onChange={(event) => setNoteForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <FormControl
                type="text"
                label="Inhalt"
                value={noteForm.description}
                onChange={(event) =>
                  setNoteForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <div className={styles.heroActions}>
                <button type="button" className={styles.primaryAction} onClick={() => void saveNote()}>
                  Speichern
                </button>
                <button type="button" className={styles.editLink} onClick={() => setShowNoteForm(false)}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}

          {showTaskForm && tab === 'timeline' ? (
            <div className={styles.formPanel}>
              <FormControl
                type="text"
                label="Titel"
                required
                value={taskForm.title}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <FormControl
                type="select"
                label="Typ"
                value={taskForm.type}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, type: event.target.value as SalesTaskType }))
                }
                options={CRM_SALES_TASK_TYPES.map((type) => ({
                  value: type,
                  label: SALES_TASK_TYPE_LABELS[type],
                }))}
              />
              <FormControl
                type="select"
                label="Priorität"
                value={taskForm.priority}
                onChange={(event) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    priority: event.target.value as SalesTaskPriority,
                  }))
                }
                options={[
                  { value: 'normal', label: SALES_TASK_PRIORITY_LABELS.normal },
                  { value: 'high', label: SALES_TASK_PRIORITY_LABELS.high },
                  { value: 'urgent', label: SALES_TASK_PRIORITY_LABELS.urgent },
                ]}
              />
              <FormControl
                type="date"
                label="Fällig"
                value={taskForm.dueDate}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))
                }
              />
              <FormControl
                type="select"
                label="Ansprechpartner"
                value={taskForm.contactId}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, contactId: event.target.value }))
                }
                options={[
                  { value: '', label: 'Kein Ansprechpartner' },
                  ...contacts
                    .filter((contact) => contact.isActive)
                    .map((contact) => ({
                      value: contact.id,
                      label: formatContactName(contact.firstName, contact.lastName),
                    })),
                ]}
              />
              <FormControl
                type="text"
                label="Beschreibung"
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <div className={styles.heroActions}>
                <button type="button" className={styles.primaryAction} onClick={() => void saveTask()}>
                  Speichern
                </button>
                <button type="button" className={styles.editLink} onClick={() => setShowTaskForm(false)}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}

          <FormControl
            type="text"
            label="Suche"
            value={timelineSearch}
            onChange={(event) => setTimelineSearch(event.target.value)}
            placeholder="Titel, Notiz, Beschreibung, Ansprechpartner"
          />
          <div className={styles.tabs} role="group" aria-label="Timeline Filter">
            {(
              [
                ['all', 'Alle'],
                ['communication', 'Kommunikation'],
                ['sales', 'Vertrieb'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={timelineFilter === value ? styles.tabActive : styles.tab}
                onClick={() => setTimelineFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {filteredTimeline.length === 0 ? (
            <p className={styles.emptyHint}>Keine Einträge für diesen Filter.</p>
          ) : (
            timelineGroups.map((group) => (
              <div key={group.group} className={styles.timelineGroup}>
                <h3 className={styles.timelineGroupTitle}>{group.label}</h3>
                <ul className={styles.offerList}>
                  {group.items.map((activity) => {
                    const contact = contacts.find((entry) => entry.id === activity.contactId);
                    return (
                      <li key={activity.id} className={styles.emptyHint}>
                        <span aria-hidden="true">{timelineIconForActivity(activity.type)} </span>
                        {displayDateTime(activity.occurredAt)} ·{' '}
                        {SALES_ACTIVITY_TYPE_LABELS[activity.type]}: {activity.title}
                        {contact
                          ? ` · ${formatContactName(contact.firstName, contact.lastName)}`
                          : ''}
                        {activity.description ? ` – ${activity.description}` : ''}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === 'tasks' ? (
        <section className={styles.detailSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Aufgaben</h2>
            {canEdit ? (
              <button type="button" className={styles.primaryAction} onClick={openTaskCreate}>
                Neu
              </button>
            ) : null}
          </div>

          {showTaskForm ? (
            <div className={styles.formPanel}>
              <FormControl
                type="text"
                label="Titel"
                required
                value={taskForm.title}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <FormControl
                type="select"
                label="Typ"
                value={taskForm.type}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, type: event.target.value as SalesTaskType }))
                }
                options={CRM_SALES_TASK_TYPES.map((type) => ({
                  value: type,
                  label: SALES_TASK_TYPE_LABELS[type],
                }))}
              />
              <FormControl
                type="select"
                label="Priorität"
                value={taskForm.priority}
                onChange={(event) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    priority: event.target.value as SalesTaskPriority,
                  }))
                }
                options={[
                  { value: 'normal', label: SALES_TASK_PRIORITY_LABELS.normal },
                  { value: 'high', label: SALES_TASK_PRIORITY_LABELS.high },
                  { value: 'urgent', label: SALES_TASK_PRIORITY_LABELS.urgent },
                ]}
              />
              <FormControl
                type="date"
                label="Fällig"
                value={taskForm.dueDate}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))
                }
              />
              <FormControl
                type="select"
                label="Ansprechpartner"
                value={taskForm.contactId}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, contactId: event.target.value }))
                }
                options={[
                  { value: '', label: 'Kein Ansprechpartner' },
                  ...contacts
                    .filter((contact) => contact.isActive)
                    .map((contact) => ({
                      value: contact.id,
                      label: formatContactName(contact.firstName, contact.lastName),
                    })),
                ]}
              />
              <FormControl
                type="text"
                label="Beschreibung"
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <div className={styles.heroActions}>
                <button type="button" className={styles.primaryAction} onClick={() => void saveTask()}>
                  Speichern
                </button>
                <button type="button" className={styles.editLink} onClick={() => setShowTaskForm(false)}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}

          {tasks.length === 0 ? (
            <p className={styles.emptyHint}>Keine Aufgaben für diesen Kunden.</p>
          ) : (
            <ul className={styles.offerList}>
              {tasks.map((task) => (
                <li key={task.id} className={styles.offerCard}>
                  <div className={styles.offerCardHeader}>
                    <span className={styles.offerTitle}>{task.title}</span>
                    <span className={styles.offerStatus}>
                      {SALES_TASK_STATUS_LABELS[task.status]}
                    </span>
                  </div>
                  <div className={styles.offerMeta}>
                    <span>{SALES_TASK_TYPE_LABELS[task.type] ?? task.type}</span>
                    <span>{SALES_TASK_PRIORITY_LABELS[task.priority]}</span>
                    <span>{task.dueAt ? `Fällig ${formatDate(task.dueAt)}` : 'Ohne Fälligkeit'}</span>
                    <span>{getUserName(task.assigneeUserId)}</span>
                  </div>
                  {canEdit && (task.status === 'open' || task.status === 'in_progress') ? (
                    <div className={styles.heroActions}>
                      <button
                        type="button"
                        className={styles.editLink}
                        onClick={() => openTaskEdit(task)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        className={styles.editLink}
                        onClick={() => void completeTask(task.id)}
                      >
                        Erledigen
                      </button>
                      <button
                        type="button"
                        className={styles.editLink}
                        onClick={() => void cancelTask(task.id)}
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'notes' ? (
        <section className={styles.detailSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Notizen</h2>
            {canEdit ? (
              <button type="button" className={styles.primaryAction} onClick={openNoteCreate}>
                Neu
              </button>
            ) : null}
          </div>
          <p className={styles.emptyHint}>Notizen sind Timeline-Einträge vom Typ „Notiz“.</p>

          {showNoteForm ? (
            <div className={styles.formPanel}>
              <FormControl
                type="text"
                label="Titel"
                required
                value={noteForm.title}
                onChange={(event) => setNoteForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <FormControl
                type="text"
                label="Inhalt"
                value={noteForm.description}
                onChange={(event) =>
                  setNoteForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <div className={styles.heroActions}>
                <button type="button" className={styles.primaryAction} onClick={() => void saveNote()}>
                  Speichern
                </button>
                <button type="button" className={styles.editLink} onClick={() => setShowNoteForm(false)}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}

          {notes.length === 0 ? (
            <p className={styles.emptyHint}>Keine Notizen vorhanden.</p>
          ) : (
            <ul className={styles.offerList}>
              {notes.map((note) => (
                <li key={note.id} className={styles.offerCard}>
                  <div className={styles.offerCardHeader}>
                    <span className={styles.offerTitle}>
                      📝 {note.title}
                    </span>
                    <span className={styles.offerStatus}>{formatDate(note.occurredAt)}</span>
                  </div>
                  {note.description ? <p className={styles.emptyHint}>{note.description}</p> : null}
                  {canEdit && note.editable && !note.isSystem ? (
                    <div className={styles.heroActions}>
                      <button
                        type="button"
                        className={styles.editLink}
                        onClick={() => openNoteEdit(note)}
                      >
                        Bearbeiten
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'documents' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Dokumente</h2>
          {documents.length === 0 ? (
            <p className={styles.emptyHint}>Keine Dokumentmetadaten vorhanden.</p>
          ) : (
            documentGroups.map((group) => (
              <div key={group.key} className={styles.documentGroup}>
                <h3 className={styles.documentGroupTitle}>{group.label}</h3>
                <ul className={styles.offerList}>
                  {group.items.map((document) => {
                    const href = documentDownloadHref(document);
                    return (
                      <li key={`${document.source}:${document.id}`} className={styles.offerCard}>
                        <div className={styles.offerCardHeader}>
                          <span className={styles.offerTitle}>{document.fileName}</span>
                          <span className={styles.offerStatus}>{document.typeLabel}</span>
                        </div>
                        <div className={styles.offerMeta}>
                          <span>{document.typeLabel}</span>
                          {document.versionNumber != null ? (
                            <span>Version {document.versionNumber}</span>
                          ) : null}
                          <span>{formatDate(document.createdAt)}</span>
                        </div>
                        {href ? (
                          <Link className={styles.editLink} to={href}>
                            Download
                          </Link>
                        ) : (
                          <span className={styles.emptyHint}>Kein Download verfügbar</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === 'advice' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Beratung</h2>
          {latestSession ? (
            <dl className={styles.grid}>
              <DetailRow
                label="Aktuelle Beratung"
                value={getSessionCustomerDisplayName(latestSession)}
              />
              <DetailRow label="Aktualisiert" value={displayDateTime(latestSession.updatedAt)} />
            </dl>
          ) : (
            <p className={styles.emptyHint}>Noch keine Beratung gestartet.</p>
          )}
          <Link className={styles.primaryAction} to={beratungPath}>
            {latestSession ? 'Beratung fortsetzen' : 'Beratung starten'}
          </Link>
        </section>
      ) : null}

      {tab === 'offer' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Angebote</h2>
          {offers.length === 0 ? (
            <p className={styles.emptyHint}>Noch kein Angebot vorhanden.</p>
          ) : (
            <ul className={styles.offerList}>
              {offers.map((offer) => (
                <li key={offer.id}>
                  <Link className={styles.offerCard} to={`/offers/${offer.id}`}>
                    <div className={styles.offerCardHeader}>
                      <span className={styles.offerTitle}>{offer.offerNumber}</span>
                      <span className={styles.offerStatus}>
                        {OFFER_WORKFLOW_STATUS_LABELS[offer.workflowStatus]}
                      </span>
                    </div>
                    <div className={styles.offerMeta}>
                      <span>Version {offer.currentVersionNumber}</span>
                      <span>{displayDateTime(offer.updatedAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'contract' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Verträge</h2>
          {contracts.length === 0 ? (
            <p className={styles.emptyHint}>Noch kein Vertrag vorhanden.</p>
          ) : (
            <ul className={styles.offerList}>
              {contracts.map((contract) => (
                <li key={contract.id}>
                  <Link className={styles.offerCard} to={`/contracts/${contract.id}`}>
                    <div className={styles.offerCardHeader}>
                      <span className={styles.offerTitle}>{contract.contractNumber}</span>
                      <span className={styles.offerStatus}>
                        {CONTRACT_STATUS_LABELS[contract.status]}
                      </span>
                    </div>
                    <div className={styles.offerMeta}>
                      <span>{displayText(contract.tariffName)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'activation' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Aktivierungen</h2>
          {activations.length === 0 ? (
            <p className={styles.emptyHint}>Noch keine Aktivierung gestartet.</p>
          ) : (
            <ul className={styles.offerList}>
              {activations.map((activation) => (
                <li key={activation.id}>
                  <Link className={styles.offerCard} to={`/activations/${activation.id}`}>
                    <div className={styles.offerCardHeader}>
                      <span className={styles.offerTitle}>{activation.activationNumber}</span>
                      <span className={styles.offerStatus}>
                        {ACTIVATION_STATUS_LABELS[activation.status]}
                      </span>
                    </div>
                    <div className={styles.offerMeta}>
                      <span>{activation.progressPercent}%</span>
                      <span>{activation.nextStep ?? '–'}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'commission' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Provision</h2>
          <p className={styles.emptyHint}>
            Die Provisionsdetails werden im bestehenden Provisionsbereich geführt – keine zweite
            Provisionswelt in der Kundenakte.
          </p>
          <Link className={styles.primaryAction} to="/sales/commission">
            Zur Provision
          </Link>
        </section>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(deactivateContactId)}
        title="Ansprechpartner deaktivieren"
        message="Der Ansprechpartner wird deaktiviert und bleibt für die Historie erhalten. Es erfolgt keine Löschung."
        confirmLabel="Deaktivieren"
        cancelLabel="Abbrechen"
        onCancel={() => setDeactivateContactId(null)}
        onConfirm={() => void confirmDeactivateContact()}
      />
    </section>
  );
}
