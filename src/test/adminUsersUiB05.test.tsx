import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersPage } from '../features/admin/AdminUsersPage';
import { CurrentUserContext } from '../app/providers/currentUserContext';
import { ServicesContext } from '../hooks/useServices';
import type { AppServices } from '../services';
import { ASSIGNABLE_USER_ROLES } from '../domain/user/user';
import { openFormSelect } from './helpers/selectFormOption';

const adminUser = {
  id: 'admin-1',
  name: 'Michael Rosenau',
  email: 'm.rosenau@amrtech.de',
  role: 'admin' as const,
  status: 'active' as const,
  salesTeamId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deactivatedAt: null,
  lastAccessAt: null,
  schemaVersion: 3,
};

function renderUsersPage(options?: {
  role?: 'admin' | 'field_service';
  invite?: ReturnType<typeof vi.fn>;
}) {
  const inviteUser =
    options?.invite ??
    vi.fn().mockResolvedValue({
      ok: true,
      user: {
        ...adminUser,
        id: 'new-1',
        name: 'Test Außendienst',
        email: 'test.fs@example.com',
        role: 'field_service',
        status: 'invited',
      },
    });

  const services = {
    adminUserService: {
      getUsers: vi.fn().mockResolvedValue([adminUser]),
      inviteUser,
      updateUser: vi.fn(),
      deactivateUser: vi.fn(),
      reactivateUser: vi.fn(),
      resendInvite: vi.fn(),
      canManageUsers: () => options?.role !== 'field_service',
    },
    adminOverviewService: {
      canAccessAdmin: () => options?.role !== 'field_service',
    },
  } as unknown as AppServices;

  const user = {
    ...adminUser,
    role: options?.role ?? 'admin',
  };

  return {
    inviteUser,
    ...render(
      <ServicesContext.Provider value={services}>
        <CurrentUserContext.Provider
          value={{
            currentUser: user,
            isLoading: false,
            authError: null,
            switchUser: async () => null,
            refresh: async () => undefined,
          }}
        >
          <MemoryRouter initialEntries={['/admin/users']}>
            <Routes>
              <Route path="/admin/users" element={<AdminUsersPage />} />
            </Routes>
          </MemoryRouter>
        </CurrentUserContext.Provider>
      </ServicesContext.Provider>,
    ),
  };
}

describe('Admin Benutzerverwaltung UI', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('zeigt Einladen-Formular mit genau zwei Rollen', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'local');
    const user = userEvent.setup();
    renderUsersPage();

    await user.click(screen.getByRole('button', { name: 'Benutzer einladen' }));
    expect(screen.getByRole('heading', { name: 'Benutzer einladen' })).toBeInTheDocument();
    expect(
      screen.getByText(/Passwort wird nicht durch den Administrator gesehen/i),
    ).toBeInTheDocument();

    const roleSelect = screen.getByLabelText('Rolle für Einladung');
    await openFormSelect(user, 'Rolle für Einladung');
    const options = screen
      .getAllByRole('option')
      .map((option) => option.getAttribute('data-value'))
      .filter(Boolean);
    expect(options).toEqual([...ASSIGNABLE_USER_ROLES]);
    expect(options).toHaveLength(2);
    expect(roleSelect).toBeInTheDocument();
  });

  it('lädt im Supabase-Modus keine Demo-Benutzertexte in die Aktion', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://vohnqrftkuefkugabcob.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    renderUsersPage();
    expect(screen.queryByRole('button', { name: 'Benutzer anlegen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Benutzer einladen' })).toBeInTheDocument();
  });
});
