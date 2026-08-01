import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FormControl } from '../../components/common/FormControl';
import { isSupabaseDataMode } from '../../config/dataMode';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { createSupabaseAuthService } from '../../services/supabaseAuthService';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { currentUser, isLoading, refresh } = useCurrentUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isSupabaseDataMode()) {
    return <Navigate to="/sales" replace />;
  }

  if (!isLoading && currentUser) {
    return <Navigate to="/sales" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const auth = createSupabaseAuthService();
      await auth.signInWithPassword(email.trim(), password);
      await refresh();
      navigate('/sales', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <h1 id="login-title" className={styles.title}>
          AMRtech Payment
        </h1>
        <p className={styles.subtitle}>Anmeldung für Administration und Außendienst</p>
        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
          <FormControl
            id="login-email"
            type="email"
            label="E-Mail"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <FormControl
            id="login-password"
            type="password"
            label="Passwort"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <button className={styles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </section>
    </main>
  );
}
