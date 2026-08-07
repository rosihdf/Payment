import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from '../v2/profile/ProfilePage';
import { CurrentUserContext } from '../app/providers/currentUserContext';
import { AndroidApkUpdateProvider } from '../context/AndroidApkUpdateProvider';

describe('Profilseite Supabase-Modus', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('zeigt keinen Demo-Text und echte UUID', () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://vohnqrftkuefkugabcob.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');

    const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    render(
      <MemoryRouter>
        <CurrentUserContext.Provider
          value={{
            currentUser: {
              id: uuid,
              name: 'Michael Rosenau',
              email: 'm.rosenau@amrtech.de',
              role: 'admin',
              status: 'active',
              salesTeamId: null,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              deactivatedAt: null,
              lastAccessAt: null,
              schemaVersion: 3,
            },
            isLoading: false,
            authError: null,
            switchUser: async () => null,
            refresh: async () => undefined,
          }}
        >
          <AndroidApkUpdateProvider>
            <ProfilePage />
          </AndroidApkUpdateProvider>
        </CurrentUserContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Angemeldeter Benutzer')).toBeInTheDocument();
    expect(screen.queryByText(/Demo-Benutzer/i)).not.toBeInTheDocument();
    expect(screen.getByText('Michael Rosenau')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.getByText('m.rosenau@amrtech.de')).toBeInTheDocument();
    expect(screen.getByText(uuid)).toBeInTheDocument();
    expect(screen.queryByText('user_001')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Administration/i })).toBeInTheDocument();
  });
});
