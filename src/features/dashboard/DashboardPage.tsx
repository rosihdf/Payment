import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { OnlineIndicator } from '../../components/feedback/OnlineIndicator';
import { PageHeader } from '../../components/layout/PageHeader';
import { USER_ROLE_LABELS } from '../../domain/user/user';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useServices } from '../../hooks/useServices';
import { formatCount } from '../../utils/format';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const { currentUser } = useCurrentUser();
  const isOnline = useOnlineStatus();
  const { leadService, tariffService } = useServices();
  const [leadCount, setLeadCount] = useState(0);
  const [tariffCount, setTariffCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void Promise.all([leadService.getLeadCount(), tariffService.getTariffCount()]).then(
      ([leads, tariffs]) => {
        setLeadCount(leads);
        setTariffCount(tariffs);
        setIsLoading(false);
      },
    );
  }, [leadService, tariffService]);

  const greeting = currentUser ? `Willkommen, ${currentUser.name}` : 'Willkommen';

  return (
    <section>
      <PageHeader
        title={greeting}
        subtitle="Überblick über Ihre Payment-Leads und Schnellzugriff"
        actions={<OnlineIndicator isOnline={isOnline} />}
      />

      {isLoading ? (
        <EmptyState
          title="Dashboard wird geladen"
          description="Demo-Daten werden vorbereitet."
        />
      ) : (
        <>
          <div className={styles.grid}>
            <article className={styles.card}>
              <h2 className={styles.cardTitle}>Aktuelle Rolle</h2>
              <p className={styles.cardValue}>
                {currentUser ? USER_ROLE_LABELS[currentUser.role] : '—'}
              </p>
            </article>

            <article className={styles.card}>
              <h2 className={styles.cardTitle}>Verbindungsstatus</h2>
              <p className={styles.cardValue}>{isOnline ? 'Online' : 'Offline'}</p>
            </article>

            <article className={styles.card}>
              <h2 className={styles.cardTitle}>Leads</h2>
              <p className={styles.cardValue}>{formatCount(leadCount, 'Lead', 'Leads')}</p>
            </article>

            <article className={styles.card}>
              <h2 className={styles.cardTitle}>Tarife</h2>
              <p className={styles.cardValue}>{formatCount(tariffCount, 'Tarif', 'Tarife')}</p>
            </article>
          </div>

          <section className={styles.quickNav}>
            <h2 className={styles.sectionTitle}>Schnellnavigation</h2>
            <div className={styles.links}>
              <Link className={styles.link} to="/leads">
                Leads anzeigen
              </Link>
              <Link className={styles.link} to="/leads/new">
                Neuen Lead anlegen
              </Link>
              <Link className={styles.link} to="/calculator">
                Zum Rechner
              </Link>
              <Link className={styles.link} to="/profile">
                Profil öffnen
              </Link>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
