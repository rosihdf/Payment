import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isSupabaseDataMode } from '../../config/dataMode';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { createSupabaseAuthService } from '../../services/supabaseAuthService';

interface RequireAuthProps {
  children: ReactNode;
}

/** Im Supabase-Modus: ohne Sitzung zur Login-Seite. Lokal: unverändert. */
export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
  const { currentUser, isLoading, authError } = useCurrentUser();

  if (!isSupabaseDataMode()) {
    return children;
  }

  if (isLoading) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>Sitzung wird geprüft…</p>
      </main>
    );
  }

  if (authError) {
    return (
      <main style={{ padding: '2rem', maxWidth: '32rem' }}>
        <h1>Zugriff verweigert</h1>
        <p>{authError}</p>
        <button
          type="button"
          onClick={() => {
            void (async () => {
              await createSupabaseAuthService().signOut();
              window.location.assign('/login');
            })();
          }}
        >
          Zur Anmeldung
        </button>
      </main>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
