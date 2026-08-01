import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { OnlineIndicator } from '../../components/feedback/OnlineIndicator';
import { PageHeader } from '../../components/layout/PageHeader';
import { isSupabaseDataMode } from '../../config/dataMode';
import { USER_ROLE_LABELS } from '../../domain/user/user';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { createSupabaseAuthService } from '../../services/supabaseAuthService';
import { APP_DISPLAY_NAME, APP_VERSION } from '../../utils/appInfo';
import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const navigate = useNavigate();
  const { currentUser, isLoading, refresh } = useCurrentUser();
  const isOnline = useOnlineStatus();
  const [signingOut, setSigningOut] = useState(false);
  const supabaseMode = isSupabaseDataMode();

  if (isLoading) {
    return (
      <section>
        <PageHeader title="Profil" subtitle="Benutzerdaten werden geladen…" />
        <EmptyState
          title="Profil wird geladen"
          description="Die Benutzerinformationen werden abgerufen."
        />
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title="Profil"
        subtitle={
          supabaseMode
            ? 'Angemeldeter Benutzer'
            : 'Angemeldeter Demo-Benutzer und App-Informationen'
        }
        actions={<OnlineIndicator isOnline={isOnline} />}
      />

      <div className={styles.card}>
        <dl className={styles.details}>
          <div className={styles.row}>
            <dt>Name</dt>
            <dd>{currentUser?.name ?? '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Rolle</dt>
            <dd>{currentUser ? USER_ROLE_LABELS[currentUser.role] : '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt>E-Mail</dt>
            <dd>{currentUser?.email ?? '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Benutzer-ID</dt>
            <dd>{currentUser?.id ?? '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Verbindungsstatus</dt>
            <dd className={styles.statusRow}>
              <OnlineIndicator isOnline={isOnline} compact />
            </dd>
          </div>
          <div className={styles.row}>
            <dt>App</dt>
            <dd>{APP_DISPLAY_NAME}</dd>
          </div>
          <div className={styles.row}>
            <dt>Version</dt>
            <dd>{APP_VERSION}</dd>
          </div>
        </dl>
      </div>

      {currentUser?.role === 'admin' ? (
        <section className={styles.adminSection} aria-labelledby="admin-section-title">
          <h2 id="admin-section-title" className={styles.adminTitle}>
            Administration
          </h2>
          <Link className={styles.adminLink} to="/admin">
            Administration
            <span className={styles.adminLinkHint} aria-hidden="true">
              →
            </span>
          </Link>
          <Link className={styles.adminLink} to="/admin/catalog">
            <span>Produkte & Konditionen</span>
            <span className={styles.adminLinkHint} aria-hidden="true">
              →
            </span>
          </Link>
        </section>
      ) : null}

      {supabaseMode ? (
        <div className={styles.adminSection}>
          <button
            type="button"
            className={styles.adminLink}
            disabled={signingOut}
            onClick={() => {
              void (async () => {
                setSigningOut(true);
                try {
                  await createSupabaseAuthService().signOut();
                  await refresh();
                  navigate('/login', { replace: true });
                } finally {
                  setSigningOut(false);
                }
              })();
            }}
          >
            {signingOut ? 'Abmelden…' : 'Abmelden'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
