import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { Lead } from '../../domain/lead/lead';
import { LEAD_INTEREST_LABELS, LEAD_STATUS_LABELS } from '../../domain/lead/lead';
import { getLeadDisplayName } from '../../domain/lead/getLeadDisplayName';
import type { User } from '../../domain/user/user';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { formatContactName, formatDate } from '../../utils/format';
import { Button } from '../ui/Button';
import { DataList, DataListCard } from '../ui/DataList';
import { FormField } from '../ui/FormField';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './LeadsPage.module.css';

export function LeadsPage() {
  const location = useLocation();
  const { currentUser } = useCurrentUser();
  const { leadService, userService } = useServices();
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void userService.getAllUsers().then(setUsers);
  }, [userService]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    void leadService
      .searchLeads(query, { userId: currentUser.id, role: currentUser.role })
      .then((result) => {
        setLeads(result);
        setIsLoading(false);
      });
  }, [leadService, query, currentUser, location.key]);

  const getUserName = (userId: string): string =>
    users.find((user) => user.id === userId)?.name ?? 'Unbekannt';

  return (
    <section>
      <PageHeader
        title="Kunden"
        description="Kunden und Interessenten – Ausgangspunkt für Beratung, Angebot und Onboarding"
        actions={
          <Link to="/leads/new">
            <Button>Neuer Kunde</Button>
          </Link>
        }
      />

      <div className={styles.search}>
        <FormField
          type="search"
          label="Kunden-Suche"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Firma, Kontakt, Ort, Anbieter oder E-Mail suchen…"
        />
      </div>

      {isLoading ? (
        <EmptyState title="Kunden werden geladen" description="Die Kundenliste wird vorbereitet." />
      ) : leads.length === 0 ? (
        <EmptyState
          title="Keine Kunden gefunden"
          description="Passen Sie die Suche an oder legen Sie einen neuen Kunden an."
          action={
            <Link to="/leads/new">
              <Button>Neuer Kunde</Button>
            </Link>
          }
        />
      ) : (
        <DataList
          items={leads}
          getKey={(lead) => lead.id}
          aria-label="Kundenliste"
          renderItem={(lead) => (
            <DataListCard
              href={`/leads/${lead.id}`}
              title={getLeadDisplayName(lead)}
              badge={<StatusBadge variant="neutral" label={LEAD_STATUS_LABELS[lead.status]} />}
              meta={
                <>
                  <span>{formatContactName(lead.contactFirstName, lead.contactLastName)}</span>
                  <span>{lead.city || 'Ort nicht angegeben'}</span>
                  <span>{LEAD_INTEREST_LABELS[lead.interest]}</span>
                  <span>
                    Nächster Kontakt:{' '}
                    {lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : 'Nicht angegeben'}
                  </span>
                  <span>Betreuer: {getUserName(lead.assignedSalesUserId)}</span>
                </>
              }
            />
          )}
        />
      )}
    </section>
  );
}
