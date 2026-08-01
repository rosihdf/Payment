import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import type { ActivationListItem } from '../../domain/activation/activationCase';
import { ACTIVATION_STATUS_LABELS } from '../../domain/activation/activationStatus';
import type { ContractListItem } from '../../domain/contract/contract';
import { CONTRACT_STATUS_LABELS } from '../../domain/contract/contractStatus';
import type { Lead } from '../../domain/lead/lead';
import type { Offer } from '../../domain/offer/offer';
import { OFFER_WORKFLOW_STATUS_LABELS } from '../../domain/offer/offerWorkflow';
import type { SalesDocument } from '../../domain/salesDocument/salesDocument';
import { SALES_DOCUMENT_TYPE_LABELS } from '../../domain/salesDocument/salesDocument';
import {
  CUSTOMER_STAND_LABELS,
  deriveCustomerPrimaryAction,
  deriveCustomerStand,
  pickLatestOffer,
  pickLatestSession,
} from '../../domain/salesWorkspace/customerRecordView';
import type { User } from '../../domain/user/user';
import type { SalesActivity } from '../../domain/salesWorkspace/salesActivity';
import { SALES_ACTIVITY_TYPE_LABELS } from '../../domain/salesWorkspace/salesActivity';
import type { SalesTask } from '../../domain/salesWorkspace/salesTask';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import {
  displayDateTime,
  displayText,
  formatContactName,
  formatDate,
} from '../../utils/format';
import { ADVICE_NEW_PATH, salesWizardSessionPath } from '../../utils/routes';
import styles from './LeadDetailPage.module.css';

type TabId =
  | 'overview'
  | 'advice'
  | 'offer'
  | 'contract'
  | 'activation'
  | 'documents'
  | 'tasks';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'advice', label: 'Beratung' },
  { id: 'offer', label: 'Angebot' },
  { id: 'contract', label: 'Vertrag' },
  { id: 'activation', label: 'Aktivierung' },
  { id: 'documents', label: 'Dokumente' },
  { id: 'tasks', label: 'Aufgaben & Verlauf' },
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
    offerWorkflowService,
    offerDocumentService,
  } = useServices();
  const [lead, setLead] = useState<Lead | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [activations, setActivations] = useState<ActivationListItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openTasks, setOpenTasks] = useState<SalesTask[]>([]);
  const [timeline, setTimeline] = useState<SalesActivity[]>([]);
  const [sessions, setSessions] = useState<BestPayComparisonSession[]>([]);
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [tab, setTab] = useState<TabId>('overview');

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
  }, [id, leadService, location.key]);

  useEffect(() => {
    if (!id || !currentUser) {
      return;
    }

    const context = toUserContext(currentUser);
    const offerContext = toOfferContext(currentUser);

    void offerService.getOffersForLead(id, offerContext).then(async (leadOffers) => {
      setOffers(leadOffers);
      const docs: SalesDocument[] = [];
      for (const offer of leadOffers) {
        const workflowDocs = await offerWorkflowService.listDocuments(offer.id);
        docs.push(...workflowDocs);
        const offerDocs = await offerDocumentService.getDocumentsForOffer(offer.id, offerContext);
        for (const doc of offerDocs) {
          docs.push({
            id: doc.id,
            schemaVersion: 1,
            offerId: offer.id,
            offerVersionId: null,
            contractId: null,
            contractVersionId: null,
            terminationId: null,
            activationId: null,
            type: 'offer_pdf',
            fileName: doc.documentNumber || doc.id,
            mimeType: 'application/pdf',
            externalReference: doc.documentNumber,
            checksum: null,
            createdAt: doc.createdAt,
            createdByUserId: '',
            createdByDisplayName: '',
          });
        }
      }
      const unique = new Map(docs.map((doc) => [doc.id, doc]));
      setDocuments([...unique.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });

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
        setTimeline([]);
        setSessions([]);
        return;
      }
      setOpenTasks(summary.openTasks);
      setTimeline(summary.timeline);
      setSessions(summary.sessions);
    });
  }, [
    activationService,
    contractService,
    currentUser,
    id,
    offerDocumentService,
    offerService,
    offerWorkflowService,
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

  if (isLoading) {
    return (
      <section>
        <PageHeader title="Kundenakte" subtitle="Daten werden geladen…" />
        <EmptyState title="Kundenakte wird geladen" description="Die Kundendaten werden abgerufen." />
      </section>
    );
  }

  if (!lead) {
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

  return (
    <section>
      <PageHeader
        title={lead.companyName}
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
          <dl className={styles.grid}>
            <DetailRow label="Aktueller Stand" value={CUSTOMER_STAND_LABELS[stand]} />
            <DetailRow label="Hauptaktion" value={primary.label} />
            <DetailRow
              label="Offene Wiedervorlage"
              value={
                openTasks[0]
                  ? `${openTasks[0].title}${openTasks[0].dueAt ? ` · ${formatDate(openTasks[0].dueAt)}` : ''}`
                  : 'Keine'
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
            <DetailRow
              label="Letzte Aktivität"
              value={
                timeline[0]
                  ? `${formatDate(timeline[0].occurredAt)} · ${timeline[0].title}`
                  : 'Keine'
              }
            />
          </dl>
        </section>
      ) : null}

      {tab === 'advice' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Beratung</h2>
          {latestSession ? (
            <dl className={styles.grid}>
              <DetailRow
                label="Aktuelle Beratung"
                value={latestSession.customerLabel || latestSession.title || latestSession.id}
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
          <h2 className={styles.sectionTitle}>Angebot</h2>
          {latestOffer ? (
            <>
              <dl className={styles.grid}>
                <DetailRow label="Angebotsnummer" value={latestOffer.offerNumber} />
                <DetailRow
                  label="Status"
                  value={OFFER_WORKFLOW_STATUS_LABELS[latestOffer.workflowStatus]}
                />
                <DetailRow label="Version" value={String(latestOffer.currentVersionNumber)} />
                <DetailRow
                  label="Letzte Bereitstellung"
                  value={displayDateTime(latestOffer.updatedAt)}
                />
                <DetailRow
                  label="Nachfassdatum"
                  value={displayDateTime(lead.nextFollowUpAt)}
                />
              </dl>
              <Link className={styles.primaryAction} to={`/offers/${latestOffer.id}`}>
                Angebot öffnen
              </Link>
            </>
          ) : (
            <p className={styles.emptyHint}>Noch kein Angebot vorhanden.</p>
          )}
        </section>
      ) : null}

      {tab === 'contract' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Vertrag</h2>
          {latestContract ? (
            <>
              <dl className={styles.grid}>
                <DetailRow label="Vertragsnummer" value={latestContract.contractNumber} />
                <DetailRow label="Status" value={CONTRACT_STATUS_LABELS[latestContract.status]} />
                <DetailRow
                  label="Laufzeit"
                  value={`${latestContract.startDate ?? '–'} – ${latestContract.endDate ?? '–'}`}
                />
                <DetailRow label="Tarif" value={displayText(latestContract.tariffName)} />
              </dl>
              <Link className={styles.primaryAction} to={`/contracts/${latestContract.id}`}>
                Vertrag öffnen
              </Link>
            </>
          ) : (
            <p className={styles.emptyHint}>Noch kein Vertrag vorhanden.</p>
          )}
        </section>
      ) : null}

      {tab === 'activation' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Aktivierung</h2>
          {latestActivation ? (
            <>
              <dl className={styles.grid}>
                <DetailRow label="Aktivierungsnummer" value={latestActivation.activationNumber} />
                <DetailRow
                  label="Status"
                  value={ACTIVATION_STATUS_LABELS[latestActivation.status]}
                />
                <DetailRow label="Fortschritt" value={`${latestActivation.progressPercent}%`} />
                <DetailRow label="Nächster Schritt" value={latestActivation.nextStep ?? '–'} />
                <DetailRow
                  label="Blocker"
                  value={
                    latestActivation.openBlockerCount > 0
                      ? String(latestActivation.openBlockerCount)
                      : 'Keine'
                  }
                />
              </dl>
              <Link className={styles.primaryAction} to={`/activations/${latestActivation.id}`}>
                Aktivierung öffnen
              </Link>
            </>
          ) : (
            <p className={styles.emptyHint}>Noch keine Aktivierung gestartet.</p>
          )}
        </section>
      ) : null}

      {tab === 'documents' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Dokumente</h2>
          {documents.length === 0 ? (
            <p className={styles.emptyHint}>Keine Dokumentmetadaten vorhanden.</p>
          ) : (
            <ul className={styles.offerList}>
              {documents.map((document) => (
                <li key={document.id} className={styles.emptyHint}>
                  {SALES_DOCUMENT_TYPE_LABELS[document.type] ?? document.type} · {document.fileName}{' '}
                  · {formatDate(document.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'tasks' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Aufgaben & Verlauf</h2>
          <h3 className={styles.subTitle}>Offene Wiedervorlagen</h3>
          {openTasks.length === 0 ? (
            <p className={styles.emptyHint}>Keine offenen Wiedervorlagen.</p>
          ) : (
            <ul className={styles.offerList}>
              {openTasks.map((task) => (
                <li key={task.id} className={styles.emptyHint}>
                  {task.title}
                  {task.dueAt ? ` · fällig ${formatDate(task.dueAt)}` : ''}
                </li>
              ))}
            </ul>
          )}
          <h3 className={styles.subTitle}>Aktivitäten</h3>
          {timeline.length === 0 ? (
            <p className={styles.emptyHint}>Noch keine Aktivitäten.</p>
          ) : (
            <ul className={styles.offerList}>
              {timeline.map((activity) => (
                <li key={activity.id} className={styles.emptyHint}>
                  {formatDate(activity.occurredAt)} · {SALES_ACTIVITY_TYPE_LABELS[activity.type]}:{' '}
                  {activity.title}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </section>
  );
}
