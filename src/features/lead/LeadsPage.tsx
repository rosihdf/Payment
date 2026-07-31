import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SearchField } from '../../components/common/SearchField';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import type { Lead } from '../../domain/lead/lead';
import { LEAD_INTEREST_LABELS, LEAD_STATUS_LABELS } from '../../domain/lead/lead';
import type { User } from '../../domain/user/user';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { formatContactName, formatDate } from '../../utils/format';
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
        subtitle="Kunden und Interessenten – Ausgangspunkt für Beratung, Angebot und Onboarding"
        actions={
          <Link className={styles.primaryAction} to="/leads/new">
            Neuer Kunde
          </Link>
        }
      />

      <div className={styles.search}>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Firma, Kontakt, Ort, Anbieter oder E-Mail suchen…"
          label="Kunden-Suche"
        />
      </div>

      {isLoading ? (
        <EmptyState
          title="Kunden werden geladen"
          description="Die Kundenliste wird vorbereitet."
        />
      ) : leads.length === 0 ? (
        <EmptyState
          title="Keine Kunden gefunden"
          description="Passen Sie die Suche an oder legen Sie einen neuen Kunden an."
          action={
            <Link className={styles.primaryAction} to="/leads/new">
              Neuer Kunde
            </Link>
          }
        />
      ) : (
        <ul className={styles.list}>
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link className={styles.card} to={`/leads/${lead.id}`}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.company}>{lead.companyName}</h2>
                  <span className={styles.status}>{LEAD_STATUS_LABELS[lead.status]}</span>
                </div>
                <p className={styles.contact}>
                  {formatContactName(lead.contactFirstName, lead.contactLastName)}
                </p>
                <div className={styles.meta}>
                  <span>{lead.city || 'Ort nicht angegeben'}</span>
                  <span>{LEAD_INTEREST_LABELS[lead.interest]}</span>
                </div>
                <div className={styles.meta}>
                  <span>
                    Nächster Kontakt:{' '}
                    {lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : 'Nicht angegeben'}
                  </span>
                  <span>{getUserName(lead.assignedSalesUserId)}</span>
                </div>
                <div className={styles.meta}>
                  <span>Aktualisiert: {formatDate(lead.updatedAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
