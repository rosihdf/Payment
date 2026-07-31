import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import type { Lead } from '../../domain/lead/lead';
import type { Offer } from '../../domain/offer/offer';
import { OFFER_STATUS_LABELS } from '../../domain/offer/offer';
import {
  LEAD_INTEREST_LABELS,
  LEAD_STATUS_LABELS,
  PAYMENT_USAGE_LABELS,
  SYNC_STATE_LABELS,
} from '../../domain/lead/lead';
import type { User } from '../../domain/user/user';
import type { SalesActivity } from '../../domain/salesWorkspace/salesActivity';
import { SALES_ACTIVITY_TYPE_LABELS } from '../../domain/salesWorkspace/salesActivity';
import type { SalesTask } from '../../domain/salesWorkspace/salesTask';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import {
  displayCents,
  displayDateTime,
  displayInteger,
  displayText,
  formatContactName,
  formatDate,
} from '../../utils/format';
import { SALES_WIZARD_NEW_PATH, salesWizardSessionPath } from '../../utils/routes';
import styles from './LeadDetailPage.module.css';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatPaymentUsage(lead: Lead): string {
  const active = (
    Object.entries(lead.paymentUsage) as Array<[keyof Lead['paymentUsage'], boolean]>
  )
    .filter(([, enabled]) => enabled)
    .map(([key]) => PAYMENT_USAGE_LABELS[key]);

  return active.length > 0 ? active.join(', ') : 'Nicht angegeben';
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { currentUser } = useCurrentUser();
  const { leadService, userService, offerService, salesWorkspaceService } = useServices();
  const [lead, setLead] = useState<Lead | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pipelinePhaseLabel, setPipelinePhaseLabel] = useState<string | null>(null);
  const [openTasks, setOpenTasks] = useState<SalesTask[]>([]);
  const [timeline, setTimeline] = useState<SalesActivity[]>([]);
  const [wizardSessionId, setWizardSessionId] = useState<string | null>(null);

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

    void offerService
      .getOffersForLead(id, {
        userId: currentUser.id,
        role: currentUser.role,
        displayName: currentUser.name,
      })
      .then(setOffers);

    void salesWorkspaceService
      .getLeadWorkspaceSummary(id, {
        userId: currentUser.id,
        role: currentUser.role,
        displayName: currentUser.name,
      })
      .then((summary) => {
        if (!summary) {
          setPipelinePhaseLabel(null);
          setOpenTasks([]);
          setTimeline([]);
          setWizardSessionId(null);
          return;
        }
        setPipelinePhaseLabel(summary.phaseLabel);
        setOpenTasks(summary.openTasks);
        setTimeline(summary.timeline.slice(0, 5));
        setWizardSessionId(summary.sessions[0]?.id ?? null);
      });
  }, [currentUser, id, offerService, salesWorkspaceService, location.key]);

  const getUserName = (userId: string): string =>
    users.find((user) => user.id === userId)?.name ?? 'Nicht angegeben';

  const canEdit =
    lead && currentUser
      ? leadService.canUserEditLead(lead, {
          userId: currentUser.id,
          role: currentUser.role,
        })
      : false;

  if (isLoading) {
    return (
      <section>
        <PageHeader title="Lead-Details" subtitle="Daten werden geladen…" />
        <EmptyState title="Lead wird geladen" description="Die Lead-Informationen werden abgerufen." />
      </section>
    );
  }

  if (!lead) {
    return (
      <section>
        <PageHeader title="Lead nicht gefunden" />
        <EmptyState
          title="Lead nicht gefunden"
          description="Der angeforderte Lead existiert nicht."
          action={
            <Link className={styles.link} to="/leads">
              Zur Leadliste
            </Link>
          }
        />
      </section>
    );
  }

  const contactName = formatContactName(lead.contactFirstName, lead.contactLastName);

  return (
    <section>
      <PageHeader
        title={lead.companyName}
        subtitle={`Kontakt: ${contactName}`}
        actions={
          <div className={styles.headerActions}>
            {canEdit ? (
              <Link className={styles.editLink} to={`/leads/${lead.id}/edit`}>
                Lead bearbeiten
              </Link>
            ) : null}
            <Link className={styles.editLink} to="/sales">
              Vertrieb
            </Link>
            <Link
              className={styles.editLink}
              to={
                wizardSessionId
                  ? salesWizardSessionPath(wizardSessionId)
                  : `${SALES_WIZARD_NEW_PATH}`
              }
            >
              Vertriebsprozess
            </Link>
            <Link className={styles.link} to="/leads">
              Zur Übersicht
            </Link>
          </div>
        }
      />

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Kontakt</h2>
        <dl className={styles.grid}>
          <DetailRow label="Firma" value={displayText(lead.companyName)} />
          <DetailRow label="Ansprechpartner" value={displayText(contactName)} />
          <DetailRow label="Telefon" value={displayText(lead.phone)} />
          <DetailRow label="E-Mail" value={displayText(lead.email)} />
          <DetailRow
            label="Anschrift"
            value={displayText([lead.street, `${lead.postalCode} ${lead.city}`.trim()].filter(Boolean).join(', '))}
          />
          <DetailRow label="Branche" value={displayText(lead.industry)} />
        </dl>
      </section>

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Payment-Situation</h2>
        <dl className={styles.grid}>
          <DetailRow label="Aktueller Anbieter" value={displayText(lead.currentProvider)} />
          <DetailRow label="Monatlicher Kartenumsatz" value={displayCents(lead.monthlyCardTurnoverCents)} />
          <DetailRow label="Monatliche Transaktionen" value={displayInteger(lead.monthlyTransactions)} />
          <DetailRow label="Durchschnittlicher Bon" value={displayCents(lead.averageTransactionValueCents)} />
          <DetailRow label="Aktuelle Terminalanzahl" value={displayInteger(lead.currentTerminalCount)} />
          <DetailRow label="Terminalmodelle" value={displayText(lead.currentTerminalModels)} />
          <DetailRow label="Payment-Nutzung" value={formatPaymentUsage(lead)} />
          <DetailRow label="Vertragsende" value={displayDateTime(lead.currentContractEndDate)} />
          <DetailRow label="Kündigungsfrist" value={displayText(lead.currentNoticePeriod)} />
        </dl>
      </section>

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Kartenmix</h2>
        <dl className={styles.grid}>
          <DetailRow label="Girocard" value={`${lead.cardMix.girocardPercent} %`} />
          <DetailRow label="Debitkarten" value={`${lead.cardMix.debitPercent} %`} />
          <DetailRow label="Kreditkarten" value={`${lead.cardMix.creditPercent} %`} />
          <DetailRow label="Sonstige" value={`${lead.cardMix.otherPercent} %`} />
        </dl>
      </section>

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Vertrieb</h2>
        <dl className={styles.grid}>
          <DetailRow label="Interesse" value={LEAD_INTEREST_LABELS[lead.interest]} />
          <DetailRow label="Status" value={LEAD_STATUS_LABELS[lead.status]} />
          <DetailRow
            label="Pipelinephase"
            value={pipelinePhaseLabel ?? 'Noch nicht ermittelt'}
          />
          <DetailRow label="Benötigte Terminals" value={String(lead.requiredTerminalCount)} />
          <DetailRow label="Nächster Kontakt" value={displayDateTime(lead.nextFollowUpAt)} />
          <DetailRow
            label="Offene Aufgaben"
            value={
              openTasks.length > 0
                ? openTasks.map((task) => task.title).join(', ')
                : 'Keine'
            }
          />
          <DetailRow label="Notizen" value={displayText(lead.notes)} />
        </dl>
        {timeline.length > 0 ? (
          <ul className={styles.offerList}>
            {timeline.map((activity) => (
              <li key={activity.id} className={styles.emptyHint}>
                {formatDate(activity.occurredAt)} · {SALES_ACTIVITY_TYPE_LABELS[activity.type]}:{' '}
                {activity.title}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={styles.detailSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Angebote</h2>
          <Link className={styles.editLink} to={`/offers/new?leadId=${lead.id}`}>
            Neues Angebot
          </Link>
        </div>

        {offers.length === 0 ? (
          <p className={styles.emptyHint}>Für diesen Lead liegen noch keine Angebote vor.</p>
        ) : (
          <ul className={styles.offerList}>
            {offers.map((offer) => (
              <li key={offer.id}>
                <Link className={styles.offerCard} to={`/offers/${offer.id}`}>
                  <div className={styles.offerCardHeader}>
                    <span className={styles.offerTitle}>{offer.title}</span>
                    <span className={styles.offerStatus}>{OFFER_STATUS_LABELS[offer.status]}</span>
                  </div>
                  <div className={styles.offerMeta}>
                    <span>{offer.offerNumber}</span>
                    <span>Aktualisiert: {formatDate(offer.updatedAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Metadaten</h2>
        <dl className={styles.grid}>
          <DetailRow label="Zuletzt geändert" value={displayDateTime(lead.updatedAt)} />
          <DetailRow label="Erstellt von" value={getUserName(lead.createdByUserId)} />
          <DetailRow label="Zuständiger Benutzer" value={getUserName(lead.assignedSalesUserId)} />
          <DetailRow label="Sync-Status" value={SYNC_STATE_LABELS[lead.syncState]} />
        </dl>
      </section>
    </section>
  );
}
