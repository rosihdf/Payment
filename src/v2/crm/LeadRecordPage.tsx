import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ACTIVATION_STATUS_LABELS } from '../../domain/activation/activationStatus';
import { CONTRACT_STATUS_LABELS } from '../../domain/contract/contractStatus';
import { LEAD_INTEREST_LABELS, LEAD_STATUS_LABELS } from '../../domain/lead/lead';
import { getLeadDisplayName } from '../../domain/lead/getLeadDisplayName';
import { formatContactName, formatDate, formatDateTime } from '../../utils/format';
import { adviceSessionPath } from '../../utils/routes';
import { Button } from '../ui/Button';
import { DataList, DataListCard } from '../ui/DataList';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import { useServices } from '../../hooks/useServices';
import { useLeadRecord, type LeadRecordTab } from './useLeadRecord';
import styles from './LeadRecordPage.module.css';

const TABS: Array<{ id: LeadRecordTab; label: string }> = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'cases', label: 'Vorgänge' },
  { id: 'contacts', label: 'Kontakte' },
  { id: 'documents', label: 'Dokumente' },
  { id: 'sales', label: 'Vertrieb' },
  { id: 'masterdata', label: 'Stammdaten' },
];

export function LeadRecordPage() {
  const [tab, setTab] = useState<LeadRecordTab>('overview');
  const data = useLeadRecord(tab);
  const { leadService } = useServices();

  const canEdit =
    data.lead && data.currentUser
      ? leadService.canUserEditLead(data.lead, {
          userId: data.currentUser.id,
          role: data.currentUser.role,
        })
      : false;

  if (data.isLoading) {
    return <EmptyState title="Kundenakte wird geladen" description="Bitte kurz warten." />;
  }

  if (!data.lead || !data.id) {
    return <EmptyState title="Kunde nicht gefunden" description="Der Datensatz existiert nicht." />;
  }

  const lead = data.lead;

  return (
    <section>
      <PageHeader
        title={getLeadDisplayName(lead)}
        description={`Kundenakte · ${lead.city || 'Ort nicht angegeben'} · ${LEAD_STATUS_LABELS[lead.status]}`}
        actions={
          <div className={styles.headerActions}>
            <Link to={`/advice?leadId=${encodeURIComponent(data.id)}`}>
              <Button>Beratung starten</Button>
            </Link>
            {canEdit ? (
              <Link to={`/leads/${data.id}/edit`}>
                <Button variant="secondary">Bearbeiten</Button>
              </Link>
            ) : null}
          </div>
        }
      />

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
        <article className={styles.panel}>
          <dl className={styles.grid}>
            <div>
              <dt>Kontakt</dt>
              <dd>{formatContactName(lead.contactFirstName, lead.contactLastName)}</dd>
            </div>
            <div>
              <dt>Telefon</dt>
              <dd>{lead.phone || '—'}</dd>
            </div>
            <div>
              <dt>E-Mail</dt>
              <dd>{lead.email || '—'}</dd>
            </div>
            <div>
              <dt>Interesse</dt>
              <dd>{LEAD_INTEREST_LABELS[lead.interest]}</dd>
            </div>
            <div>
              <dt>Nächster Kontakt</dt>
              <dd>{lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : '—'}</dd>
            </div>
            <div>
              <dt>Offene Aufgaben</dt>
              <dd>{data.tasks.filter((task) => task.status !== 'done').length}</dd>
            </div>
          </dl>
        </article>
      ) : null}

      {tab === 'cases' ? (
        <div className={styles.stack}>
          <section>
            <h2 className={styles.sectionTitle}>Timeline</h2>
            {data.timeline.length === 0 ? (
              <EmptyState title="Keine Vorgänge" description="Noch keine Aktivitäten erfasst." />
            ) : (
              <DataList
                items={data.timeline}
                getKey={(entry) => entry.id}
                renderItem={(entry) => (
                  <DataListCard
                    title={entry.title}
                    meta={`${formatDateTime(entry.occurredAt)} · ${entry.type}`}
                  />
                )}
              />
            )}
          </section>
          <section>
            <h2 className={styles.sectionTitle}>Aufgaben</h2>
            {data.tasks.length === 0 ? (
              <EmptyState title="Keine Aufgaben" description="Keine offenen oder erledigten Aufgaben." />
            ) : (
              <DataList
                items={data.tasks}
                getKey={(task) => task.id}
                renderItem={(task) => (
                  <DataListCard
                    title={task.title}
                    badge={
                      <StatusBadge
                        variant={task.status === 'done' ? 'success' : 'warning'}
                        label={task.status === 'done' ? 'Erledigt' : 'Offen'}
                      />
                    }
                    meta={task.dueAt ? `Fällig: ${formatDate(task.dueAt)}` : undefined}
                  />
                )}
              />
            )}
          </section>
        </div>
      ) : null}

      {tab === 'contacts' ? (
        data.contacts.length === 0 ? (
          <EmptyState title="Keine Kontakte" description="Noch keine Ansprechpartner hinterlegt." />
        ) : (
          <DataList
            items={data.contacts}
            getKey={(contact) => contact.id}
            renderItem={(contact) => (
              <DataListCard
                title={formatContactName(contact.firstName, contact.lastName)}
                badge={
                  contact.isPrimary ? (
                    <StatusBadge variant="info" label="Hauptkontakt" />
                  ) : undefined
                }
                meta={[contact.role, contact.phone, contact.email].filter(Boolean).join(' · ')}
              />
            )}
          />
        )
      ) : null}

      {tab === 'documents' ? (
        data.documents.length === 0 ? (
          <EmptyState title="Keine Dokumente" description="Noch keine Dokumente verknüpft." />
        ) : (
          <DataList
            items={data.documents}
            getKey={(doc) => doc.id}
            renderItem={(doc) => (
              <DataListCard title={doc.fileName} meta={doc.typeLabel} />
            )}
          />
        )
      ) : null}

      {tab === 'sales' ? (
        <div className={styles.stack}>
          <section>
            <h2 className={styles.sectionTitle}>Beratungen</h2>
            <Link to={`/advice?leadId=${encodeURIComponent(data.id)}`}>
              <Button variant="secondary">Neue Beratung</Button>
            </Link>
            {data.sessions.length === 0 ? (
              <EmptyState title="Keine Beratungen" description="Noch keine Beratung für diesen Kunden." />
            ) : (
              <DataList
                items={data.sessions}
                getKey={(session) => session.id}
                renderItem={(session) => (
                  <DataListCard
                    title={session.title ?? 'Beratung'}
                    meta={formatDate(session.updatedAt)}
                    href={adviceSessionPath(session.id)}
                  />
                )}
              />
            )}
          </section>
          <section>
            <h2 className={styles.sectionTitle}>Angebote</h2>
            {data.offers.length === 0 ? (
              <EmptyState title="Keine Angebote" description="Noch kein Angebot erstellt." />
            ) : (
              <DataList
                items={data.offers}
                getKey={(offer) => offer.id}
                renderItem={(offer) => (
                  <DataListCard
                    title={offer.offerNumber ?? offer.title}
                    meta={offer.title}
                    href={`/offers/${offer.id}`}
                  />
                )}
              />
            )}
          </section>
          <section>
            <h2 className={styles.sectionTitle}>Verträge</h2>
            {data.contracts.length === 0 ? (
              <EmptyState title="Keine Verträge" description="Noch kein Vertrag hinterlegt." />
            ) : (
              <DataList
                items={data.contracts}
                getKey={(entry) => entry.id}
                renderItem={(entry) => (
                  <DataListCard
                    title={entry.contractNumber}
                    meta={
                      CONTRACT_STATUS_LABELS[entry.status as keyof typeof CONTRACT_STATUS_LABELS] ??
                      entry.status
                    }
                    href={`/contracts/${entry.id}`}
                  />
                )}
              />
            )}
          </section>
          <section>
            <h2 className={styles.sectionTitle}>Aktivierungen</h2>
            {data.activations.length === 0 ? (
              <EmptyState title="Keine Aktivierungen" description="Noch keine Aktivierung gestartet." />
            ) : (
              <DataList
                items={data.activations}
                getKey={(entry) => entry.id}
                renderItem={(entry) => (
                  <DataListCard
                    title={entry.activationNumber}
                    meta={
                      ACTIVATION_STATUS_LABELS[
                        entry.status as keyof typeof ACTIVATION_STATUS_LABELS
                      ] ?? entry.status
                    }
                    href={`/activations/${entry.id}`}
                  />
                )}
              />
            )}
          </section>
        </div>
      ) : null}

      {tab === 'masterdata' ? (
        <article className={styles.panel}>
          <dl className={styles.grid}>
            <div>
              <dt>Firma</dt>
              <dd>{lead.companyName || '—'}</dd>
            </div>
            <div>
              <dt>Branche</dt>
              <dd>{lead.industry || '—'}</dd>
            </div>
            <div>
              <dt>Adresse</dt>
              <dd>
                {[lead.street, lead.postalCode, lead.city].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt>Aktueller Anbieter</dt>
              <dd>{lead.currentProvider || '—'}</dd>
            </div>
            <div>
              <dt>Notizen</dt>
              <dd>{lead.notes || '—'}</dd>
            </div>
          </dl>
          {canEdit ? (
            <Link to={`/leads/${data.id}/edit`}>
              <Button variant="secondary">Stammdaten bearbeiten</Button>
            </Link>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
