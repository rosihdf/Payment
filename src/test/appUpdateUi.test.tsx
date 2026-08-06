import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppUpdateProvider } from '../app/providers/AppUpdateProvider';
import { CurrentUserContext } from '../app/providers/currentUserContext';
import type { AppUpdatePreferenceStore } from '../domain/appUpdate/appUpdatePreferences';
import type { User } from '../domain/user/user';
import { AppUpdateBanner } from '../features/appUpdate/AppUpdateBanner';
import { AppUpdateGate } from '../features/appUpdate/AppUpdateGate';
import { AppInfoSection } from '../features/profile/AppInfoSection';
import type { ApkCacheWriter } from '../native/apkUpdateNative';
import { AppUpdateService } from '../services/appUpdateService';

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    versionName: '1.0.7',
    versionCode: 10007,
    minimumVersionCode: 10000,
    mandatory: false,
    downloadUrl: 'https://example.com/AMRtech-Payment-1.0.7.apk',
    sha256: 'b'.repeat(64),
    sizeBytes: 2048,
    publishedAt: '2026-08-06T17:00:00.000Z',
    releaseNotes: 'Nativer Updatepfad.',
    releaseTag: 'v1.0.7',
    sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ...overrides,
  };
}

function memoryStore(): AppUpdatePreferenceStore {
  const data: Record<string, string> = {};
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

function memoryCache(): ApkCacheWriter {
  return {
    async write() {},
    async delete() {},
  };
}

const testUser: User = {
  id: 'user_001',
  name: 'Test',
  email: 't@amrtech.de',
  role: 'field_service',
  status: 'active',
  salesTeamId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deactivatedAt: null,
  lastAccessAt: null,
  schemaVersion: 3,
};

function renderAuthenticated(
  ui: React.ReactNode,
  service: AppUpdateService,
  initialPath = '/offers',
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CurrentUserContext.Provider
        value={{
          currentUser: testUser,
          isLoading: false,
          authError: null,
          switchUser: async () => null,
          refresh: async () => undefined,
        }}
      >
        <AppUpdateProvider service={service}>
          <AppUpdateGate>
            <AppUpdateBanner />
            <Routes>
              <Route path="/profile" element={<div>{ui}</div>} />
              <Route path="*" element={<div>Produktive Seite</div>} />
            </Routes>
          </AppUpdateGate>
        </AppUpdateProvider>
      </CurrentUserContext.Provider>
    </MemoryRouter>,
  );
}

function createAndroidService(
  overrides: ConstructorParameters<typeof AppUpdateService>[0] = {},
) {
  return new AppUpdateService({
    installedVersionCode: 10006,
    installedVersionName: '1.0.6',
    isNativeAndroidFn: () => true,
    preferenceStore: memoryStore(),
    apkCache: memoryCache(),
    apkInstaller: {
      openFromCache: async () => undefined,
      openUnknownSourcesSettings: async () => undefined,
    },
    log: () => undefined,
    fetchImpl: async () => new Response(JSON.stringify(validManifest()), { status: 200 }),
    ...overrides,
  });
}

describe('Update Banner und App-Info Aktionen', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('Banner: Jetzt installieren + Später; App-Info: Jetzt installieren + Erneut prüfen, kein Später', async () => {
    const service = createAndroidService();
    renderAuthenticated(<AppInfoSection />, service, '/profile');

    await waitFor(() => {
      expect(screen.getAllByText('Neue Version verfügbar').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByRole('button', { name: 'Jetzt installieren' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Später' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erneut prüfen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Jetzt prüfen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update herunterladen' })).not.toBeInTheDocument();

    // Später nur einmal (Banner), nicht in App-Info doppelt als zweites Konzept
    expect(screen.getAllByRole('button', { name: 'Später' })).toHaveLength(1);
  });

  it('App-Info idle zeigt Jetzt prüfen', () => {
    const service = createAndroidService({
      fetchImpl: vi.fn(),
    });
    // Kein Auto-Check: Provider braucht User – idle bleibt bis Check
    render(
      <MemoryRouter>
        <AppUpdateProvider service={service}>
          <AppInfoSection />
        </AppUpdateProvider>
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Noch nicht geprüft').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Jetzt prüfen' })).toBeInTheDocument();
  });

  it('Später schließt Banner, App-Info behält Update', async () => {
    const user = userEvent.setup();
    const service = createAndroidService();
    renderAuthenticated(<AppInfoSection />, service, '/profile');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Später' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Später' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Später' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Jetzt installieren' })).toBeInTheDocument();
    expect(screen.getByText('Neue Version verfügbar')).toBeInTheDocument();
  });

  it('Pflichtupdate: kein Später', async () => {
    const service = createAndroidService({
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ mandatory: true })), { status: 200 }),
    });
    renderAuthenticated(<AppInfoSection />, service, '/offers');

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Später' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jetzt installieren' })).toBeInTheDocument();
  });

  it('Web: kein Banner und kein APK-Fetch', async () => {
    const fetchImpl = vi.fn();
    const service = createAndroidService({
      isNativeAndroidFn: () => false,
      fetchImpl,
    });
    renderAuthenticated(<AppInfoSection />, service, '/profile');
    await waitFor(() => {
      expect(screen.getByText(/Service Worker/i)).toBeInTheDocument();
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByText('Neue Version verfügbar')).not.toBeInTheDocument();
  });

  it('Jetzt installieren startet nativen Pfad ohne Browser', async () => {
    const user = userEvent.setup();
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const openUrl = vi.fn();
    const openFromCache = vi.fn(async () => undefined);
    const service = createAndroidService({
      openUrl,
      apkInstaller: {
        openFromCache,
        openUnknownSourcesSettings: async () => undefined,
      },
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('latest.json') || url.includes('example.com') === false) {
          if (url.endsWith('.apk')) {
            return new Response(bytes, {
              status: 200,
              headers: { 'content-length': String(bytes.byteLength) },
            });
          }
        }
        if (url.includes('latest.json')) {
          return new Response(
            JSON.stringify(
              validManifest({
                sha256,
                sizeBytes: bytes.byteLength,
                downloadUrl: 'https://example.com/app.apk',
              }),
            ),
            { status: 200 },
          );
        }
        return new Response(bytes, {
          status: 200,
          headers: { 'content-length': String(bytes.byteLength) },
        });
      },
    });

    renderAuthenticated(<AppInfoSection />, service, '/profile');
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Jetzt installieren' }).length).toBeGreaterThan(0);
    });
    await user.click(screen.getAllByRole('button', { name: 'Jetzt installieren' })[0]!);
    await waitFor(() => {
      expect(openFromCache).toHaveBeenCalled();
    });
    expect(openUrl).not.toHaveBeenCalled();
  });
});
