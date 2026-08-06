import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { LEAD_STATUS_LABELS } from '../../domain/lead/lead';
import { getLeadDisplayName } from '../../domain/lead/getLeadDisplayName';
import { getAdvisorDisplayLabel } from '../../domain/lead/leadVisibility';
import type { User } from '../../domain/user/user';
import { formatContactName, formatDate } from '../../utils/format';
import { Button } from '../ui/Button';
import { DataList, DataListCard } from '../ui/DataList';
import { PageHeader } from '../ui/PageHeader';
import { useServices } from '../../hooks/useServices';
import { useLeadRecord } from './useLeadRecord';
import styles from './LeadRecordPage.module.css';

export function LeadRecordPage() {
  const data = useLeadRecord();
  const { leadService, userService, salesWizardService } = useServices();
  const [users, setUsers] = useState<User[]>([]);
  const [hasActiveDraft, setHasActiveDraft] = useState(false);

  useEffect(() => {
    void userService.getAllUsers().then(setUsers);
  }, [userService]);

  useEffect(() => {
    if (!data.id || !data.currentUser) {
      setHasActiveDraft(false);
      return;
    }
    let cancelled = false;
    void salesWizardService
      .findActiveDraftForLead(data.id, {
        userId: data.currentUser.id,
        role: data.currentUser.role,
        displayName: data.currentUser.name,
      })
      .then((draft) => {
        if (!cancelled) {
          setHasActiveDraft(Boolean(draft));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [data.currentUser, data.id, salesWizardService]);

  const canEdit =
    data.lead && data.currentUser
      ? leadService.canUserEditLead(data.lead, {
          userId: data.currentUser.id,
          role: data.currentUser.role,
        })
      : false;

  if (data.isLoading) {
    return <EmptyState title="Kunde wird geladen" description="Bitte kurz warten." />;
  }

  if (!data.lead || !data.id) {
    return <EmptyState title="Kunde nicht gefunden" description="Der Datensatz existiert nicht." />;
  }

  const lead = data.lead;
  const advisorName = getAdvisorDisplayLabel(
    lead.assignedSalesUserId,
    (userId) => users.find((user) => user.id === userId)?.name,
  );

  return (
    <section>
      <PageHeader
        title={getLeadDisplayName(lead)}
        description={`${lead.city || 'Ort nicht angegeben'} · ${LEAD_STATUS_LABELS[lead.status]}`}
        actions={
          <div className={styles.headerActions}>
            <Link to={`/advice?leadId=${encodeURIComponent(data.id)}`}>
              <Button>{hasActiveDraft ? 'Beratung fortsetzen' : 'Beratung starten'}</Button>
            </Link>
            {canEdit ? (
              <Link to={`/leads/${data.id}/edit`}>
                <Button variant="secondary">Bearbeiten</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <div className={styles.stack}>
        <section>
          <h2 className={styles.sectionTitle}>Stammdaten</h2>
          <article className={styles.panel}>
            <dl className={styles.grid}>
              <div>
                <dt>Firma</dt>
                <dd>{lead.companyName || '—'}</dd>
              </div>
              <div>
                <dt>Kontakt</dt>
                <dd>{formatContactName(lead.contactFirstName, lead.contactLastName)}</dd>
              </div>
              <div>
                <dt>Adresse</dt>
                <dd>
                  {[lead.street, lead.postalCode, lead.city].filter(Boolean).join(', ') || '—'}
                </dd>
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
                <dt>Branche</dt>
                <dd>{lead.industry || '—'}</dd>
              </div>
              <div>
                <dt>Betreuer</dt>
                <dd>{advisorName}</dd>
              </div>
            </dl>
          </article>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Bestehende Angebote</h2>
          {data.offers.length === 0 ? (
            <EmptyState title="Keine Angebote" description="Noch kein Angebot erstellt." />
          ) : (
            <DataList
              items={data.offers}
              getKey={(offer) => offer.id}
              renderItem={(offer) => (
                <DataListCard
                  title={offer.offerNumber ?? offer.title}
                  meta={[offer.title, formatDate(offer.updatedAt)].filter(Boolean).join(' · ')}
                  href={`/offers/${offer.id}`}
                />
              )}
            />
          )}
        </section>
      </div>
    </section>
  );
}
