import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CurrentUserContext } from '../app/providers/currentUserContext';
import { ServicesContext } from '../hooks/useServices';
import type { AppServices } from '../services';
import type { SalesWorkspaceView } from '../services/salesWorkspaceService';
import { WorkspacePage } from '../v2/workspace/WorkspacePage';

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

const emptyView = {
  scope: 'mine',
  canUseTeamScope: false,
  searchHits: [],
  dayWork: {
    adviceDrafts: [],
    overdue: [],
    today: [],
    blocked: [],
    nextCases: [],
  },
} as unknown as SalesWorkspaceView;

function renderWorkspace(options: {
  getWorkspaceView: ReturnType<typeof vi.fn>;
  syncAutomaticTasks?: ReturnType<typeof vi.fn>;
}) {
  const services = {
    salesWorkspaceService: {
      getWorkspaceView: options.getWorkspaceView,
      syncAutomaticTasks:
        options.syncAutomaticTasks ??
        vi.fn().mockImplementation(() => new Promise(() => undefined)),
    },
  } as unknown as AppServices;

  return render(
    <ServicesContext.Provider value={services}>
      <CurrentUserContext.Provider
        value={{
          currentUser: adminUser,
          isLoading: false,
          authError: null,
          switchUser: async () => null,
          refresh: async () => undefined,
        }}
      >
        <MemoryRouter>
          <WorkspacePage />
        </MemoryRouter>
      </CurrentUserContext.Provider>
    </ServicesContext.Provider>,
  );
}

describe('WorkspacePage – Ladezustand', () => {
  it('zeigt den Arbeitsplatz, ohne auf die Hintergrund-Synchronisation zu warten', async () => {
    const getWorkspaceView = vi.fn().mockResolvedValue(emptyView);
    renderWorkspace({ getWorkspaceView });

    expect(await screen.findByRole('heading', { name: 'Überfällig' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Arbeitsplatz wird geladen' })).not.toBeInTheDocument();
    expect(getWorkspaceView).toHaveBeenCalledTimes(1);
  });

  it('zeigt einen Fehlerzustand statt eines dauerhaften Spinners', async () => {
    const getWorkspaceView = vi.fn().mockRejectedValue(new Error('Daten konnten nicht geladen werden'));
    renderWorkspace({ getWorkspaceView });

    expect(
      await screen.findByRole('heading', { name: 'Arbeitsplatz konnte nicht geladen werden' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Arbeitsplatz wird geladen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erneut laden' })).toBeInTheDocument();
  });

  it('lädt nach einem Fehler erneut und blendet den Spinner wieder aus', async () => {
    const getWorkspaceView = vi
      .fn()
      .mockRejectedValueOnce(new Error('Erster Fehler'))
      .mockResolvedValueOnce(emptyView);
    renderWorkspace({ getWorkspaceView });

    expect(
      await screen.findByRole('heading', { name: 'Arbeitsplatz konnte nicht geladen werden' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await screen.findByRole('heading', { name: 'Überfällig' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Arbeitsplatz wird geladen' })).not.toBeInTheDocument();
    expect(getWorkspaceView).toHaveBeenCalledTimes(2);
  });

  it('blockiert die Anzeige nicht, wenn die Hintergrund-Synchronisation fehlschlägt', async () => {
    const getWorkspaceView = vi.fn().mockResolvedValue(emptyView);
    const syncAutomaticTasks = vi.fn().mockRejectedValue(new Error('Sync fehlgeschlagen'));
    renderWorkspace({ getWorkspaceView, syncAutomaticTasks });

    expect(await screen.findByRole('heading', { name: 'Überfällig' })).toBeInTheDocument();
    await waitFor(() => {
      expect(syncAutomaticTasks).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Automatische Aufgaben konnten nicht aktualisiert werden.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Arbeitsplatz wird geladen' })).not.toBeInTheDocument();
  });
});
