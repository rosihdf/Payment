import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '../features/auth/RequireAuth';
import { CurrentUserContext } from '../app/providers/currentUserContext';

describe('RequireAuth Supabase-Redirect', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('leitet ohne Session zu /login um', () => {
    vi.stubEnv('VITE_DATA_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://vohnqrftkuefkugabcob.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');

    render(
      <MemoryRouter initialEntries={['/sales']}>
        <CurrentUserContext.Provider
          value={{
            currentUser: null,
            isLoading: false,
            authError: null,
            switchUser: async () => null,
            refresh: async () => undefined,
          }}
        >
          <Routes>
            <Route
              path="/sales"
              element={
                <RequireAuth>
                  <div>private</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div>login-page</div>} />
          </Routes>
        </CurrentUserContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
});
