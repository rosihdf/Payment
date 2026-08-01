import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FormControl } from '../../components/common/FormControl';
import { isSupabaseDataMode } from '../../config/dataMode';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { createSupabaseAuthService } from '../../services/supabaseAuthService';
import styles from './LoginPage.module.css';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refresh } = useCurrentUser();
  const [ready, setReady] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseDataMode()) {
      setReady(true);
      return;
    }

    let active = true;
    void (async () => {
      const client = getSupabaseClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');

      try {
        if (code) {
          const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        } else {
          // Hash-Tokens (invite/recovery) werden durch detectSessionInUrl übernommen
          await client.auth.getSession();
        }

        const {
          data: { session },
        } = await client.auth.getSession();
        if (!active) return;

        if (!session) {
          setError('Einladungslink ungültig oder abgelaufen.');
          setReady(true);
          return;
        }

        setNeedsPassword(true);
        setReady(true);
      } catch {
        if (active) {
          setError('Einladungslink ungültig oder abgelaufen.');
          setReady(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!isSupabaseDataMode()) {
    return <Navigate to="/sales" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen haben.');
      return;
    }
    if (password !== confirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    setSubmitting(true);
    try {
      const auth = createSupabaseAuthService();
      await auth.completeInvitePassword(password);
      await refresh();
      navigate('/sales', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passwort setzen fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="invite-title">
        <h1 id="invite-title" className={styles.title}>
          Passwort festlegen
        </h1>
        <p className={styles.subtitle}>
          Schließen Sie Ihre Einladung ab. Das Passwort ist nur Ihnen bekannt.
        </p>

        {!ready ? <p>Einladung wird geprüft…</p> : null}

        {ready && needsPassword ? (
          <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
            <FormControl
              id="invite-password"
              type="password"
              label="Neues Passwort"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              min={8}
            />
            <FormControl
              id="invite-password-confirm"
              type="password"
              label="Passwort bestätigen"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              min={8}
            />
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <button className={styles.submit} type="submit" disabled={submitting}>
              {submitting ? 'Speichern…' : 'Passwort speichern und anmelden'}
            </button>
          </form>
        ) : null}

        {ready && !needsPassword && error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
