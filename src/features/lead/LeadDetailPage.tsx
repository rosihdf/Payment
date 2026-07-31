import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import type { ActivationListItem } from '../../domain/activation/activationCase';
import { ACTIVATION_STATUS_LABELS } from '../../domain/activation/activationStatus';
import type { ContractListItem } from '../../domain/contract/contract';
import { CONTRACT_STATUS_LABELS } from '../../domain/contract/contractStatus';
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
  } = useServices();
  const [lead, setLead] = useState<Lead | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [activations, setActivations] = useState<ActivationListItem[]>([]);
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
  }, [
    activationService,
    contractService,
    currentUser,
    id,
    offerService,
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

  if (isLoading) {
    return (
      <section>
        <PageHeader title="Kunde" subtitle="Daten werden geladen…" />
        <EmptyState title="Kunde wird geladen" description="Die Kundendaten werden abgerufen." />
      </section>
    );
  }

  if (!lead) {
    return (
      <section>
        <PageHeader title="Kunde nicht gefunden" />
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
  const beratungPath = wizardSessionId
    ? salesWizardSessionPath(wizardSessionId)
    : `${SALES_WIZARD_NEW_PATH}`;

  return (
    <section>
      <PageHeader
        title={lead.companyName}
        subtitle={`Kontakt: ${contactName}`}
        actions={
          <div className={styles.headerActions}>
            <Link className={styles.editLink} to={beratungPath}>
              Beratung
            </Link>
            {canEdit ? (
              <Link className={styles.editLink} to={`/leads/${lead.id}/edit`}>
                Bearbeiten
              </Link>
            ) : null}
            <Link className={styles.editLink} to="/sales">
              Arbeitsplatz
            </Link>
            <Link className={styles.link} to="/leads">
              Zur Übersicht
            </Link>
          </div>
        }
      />

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Nächster Schritt</h2>
        <dl className={styles.grid}>
          <DetailRow label="Phase" value={pipelinePhaseLabel ?? 'Noch nicht ermittelt'} />
          <DetailRow
            label="Offene Aufgaben"
            value={
              openTasks.length > 0
                ? openTasks.map((task) => task.title).join(', ')
                : 'Keine'
            }
          />
        </dl>
        <div className={styles.headerActions}>
          <Link className={styles.editLink} to={beratungPath}>
            Beratung öffnen
          </Link>
          {offers[0] ? (
            <Link className={styles.editLink} to={`/offers/${offers[0].id}`}>
              Aktuelles Angebot
            </Link>
          ) : null}
          {contracts[0] ? (
            <Link className={styles.editLink} to={`/contracts/${contracts[0].id}`}>
              Vertrag
            </Link>
          ) : null}
          {activations[0] ? (
            <Link className={styles.editLink} to={`/activations/${activations[0].id}`}>
              Onboarding
            </Link>
          ) : null}
        </div>
      </section>

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Kontakt</h2>
        <dl className={styles.grid}>
          <DetailRow label="Firma" value={displayText(lead.companyName)} />
          <DetailRow label="Ansprechpartner" value={displayText(contactName)} />
          <DetailRow label="Telefon" value={displayText(lead.phone)} />
          <DetailRow label="E-Mail" value={displayText(lead.email)} />
          <DetailRow
            label="Anschrift"
            value={displayText(
              [lead.street, `${lead.postalCode} ${lead.city}`.trim()].filter(Boolean).join(', '),
            )}
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
        <h2 className={styles.sectionTitle}>Verlauf</h2>
        <dl className={styles.grid}>
          <DetailRow label="Interesse" value={LEAD_INTEREST_LABELS[lead.interest]} />
          <DetailRow label="Status" value={LEAD_STATUS_LABELS[lead.status]} />
          <DetailRow label="Benötigte Terminals" value={String(lead.requiredTerminalCount)} />
          <DetailRow label="Nächster Kontakt" value={displayDateTime(lead.nextFollowUpAt)} />
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
          <Link className={styles.editLink} to={beratungPath}>
            Über Beratung erstellen
          </Link>
        </div>

        {offers.length === 0 ? (
          <p className={styles.emptyHint}>Für diesen Kunden liegen noch keine Angebote vor.</p>
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
        <h2 className={styles.sectionTitle}>Verträge</h2>
        {contracts.length === 0 ? (
          <p className={styles.emptyHint}>Noch kein Vertrag für diesen Kunden.</p>
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Onboarding</h2>
        {activations.length === 0 ? (
          <p className={styles.emptyHint}>Noch kein Onboarding für diesen Kunden.</p>
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
                    <span>Fortschritt: {activation.progressPercent}%</span>
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
