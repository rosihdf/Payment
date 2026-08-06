import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppUpdateProvider } from '../app/providers/AppUpdateProvider';
import { CurrentUserContext } from '../app/providers/currentUserContext';
import type { AppUpdatePreferenceStore } from '../domain/appUpdate/appUpdatePreferences';
import { AppUpdateBanner } from '../features/appUpdate/AppUpdateBanner';
import { AppUpdateGate } from '../features/appUpdate/AppUpdateGate';
import { AppInfoSection } from '../features/profile/AppInfoSection';
import { AppUpdateService } from '../services/appUpdateService';
import type { User } from '../domain/user/user';

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    versionName: '1.0.5',
    versionCode: 10005,
    minimumVersionCode: 10000,
    mandatory: false,
    downloadUrl: 'https://example.com/AMRtech-Payment-1.0.5.apk',
    sha256: 'b'.repeat(64),
    sizeBytes: 2048,
    publishedAt: '2026-08-02T20:00:00.000Z',
    releaseNotes: 'Updatefunktion und Downloadhinweis.',
    releaseTag: 'android-1.0.5',
    sourceCommit: '4a8d369a8245592b7d74cab481e3872289cc0f54',
    ...overrides,
  };
}

function memoryStore(): AppUpdatePreferenceStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const testUser: User = {
  id: 'user_android_test',
  name: 'Test User',
  email: 'test@amrtech.de',
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
  user: User | null = testUser,
  isLoading = false,
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CurrentUserContext.Provider
        value={{
          currentUser: user,
          isLoading,
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
              <Route path="/offers" element={<div>Produktive Seite</div>} />
              <Route path="/leads" element={<div>Leads Seite</div>} />
              <Route path="*" element={<div>Produktive Seite</div>} />
            </Routes>
          </AppUpdateGate>
        </AppUpdateProvider>
      </CurrentUserContext.Provider>
    </MemoryRouter>,
  );
}

describe('Automatischer Update-Hinweis', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('zeigt Banner bei neuer Version und Später blendet für 24h aus', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    let nowMs = 1_000_000;
    const service = new AppUpdateService({
      installedVersionCode: 10000,
      installedVersionName: '1.0.0',
      isNativeAndroidFn: () => true,
      preferenceStore: store,
      nowMs: () => nowMs,
      fetchImpl: async () => new Response(JSON.stringify(validManifest()), { status: 200 }),
    });

    renderAuthenticated(<AppInfoSection />, service);

    await waitFor(() => {
      expect(screen.getByText('Neue Version verfügbar')).toBeInTheDocument();
    });
    expect(screen.getByText('Version 1.0.5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jetzt installieren' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Später' }));
    await waitFor(() => {
      expect(screen.queryByText('Neue Version verfügbar')).not.toBeInTheDocument();
    });

    // innerhalb 24h bleibt ausgeblendet
    nowMs += 60_000;
    expect(service.shouldShowOptionalBanner()).toBe(false);
    expect(screen.queryByText('Neue Version verfügbar')).not.toBeInTheDocument();
  });

  it('zeigt Banner für höhere Version trotz Snooze einer älteren', async () => {
    const store = memoryStore();
    const nowMs = 2_000_000;
    const service = new AppUpdateService({
      installedVersionCode: 10000,
      installedVersionName: '1.0.0',
      isNativeAndroidFn: () => true,
      preferenceStore: store,
      nowMs: () => nowMs,
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ versionCode: 10006, versionName: '1.0.6' })), {
          status: 200,
        }),
    });
    // alte Version snoozed
    store.setItem('app_update_snoozed_version', '10005');
    store.setItem('app_update_snoozed_until', String(nowMs + 86_400_000));

    renderAuthenticated(null, service);

    await waitFor(() => {
      expect(screen.getByText('Neue Version verfügbar')).toBeInTheDocument();
    });
    expect(screen.getByText('Version 1.0.6')).toBeInTheDocument();
  });

  it('zeigt bei Pflichtupdate kein Später und blockiert außerhalb Profil', async () => {
    const service = new AppUpdateService({
      installedVersionCode: 10000,
      installedVersionName: '1.0.0',
      isNativeAndroidFn: () => true,
      preferenceStore: memoryStore(),
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ mandatory: true })), { status: 200 }),
    });

    renderAuthenticated(<AppInfoSection />, service, '/offers');

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
    expect(screen.getByText('Pflichtupdate erforderlich')).toBeInTheDocument();
    expect(screen.queryByText('Produktive Seite')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Später' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jetzt installieren' })).toBeInTheDocument();
  });

  it('nutzt vorhandenen Downloadpfad für Jetzt installieren', async () => {
    const user = userEvent.setup();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const openUrl = vi.fn();
    const service = new AppUpdateService({
      installedVersionCode: 10000,
      installedVersionName: '1.0.0',
      isNativeAndroidFn: () => true,
      preferenceStore: memoryStore(),
      openUrl,
      fetchImpl: async (input) => {
        const url = String(input);
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
        return new Response(bytes, { status: 200 });
      },
    });

    renderAuthenticated(null, service);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jetzt installieren' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Jetzt installieren' }));
    await waitFor(() => {
      expect(openUrl).toHaveBeenCalledWith('https://example.com/app.apk');
    });
  });

  it('führt im Web keinen APK-Fetch aus und zeigt kein Banner', async () => {
    const fetchImpl = vi.fn();
    const service = new AppUpdateService({
      isNativeAndroidFn: () => false,
      preferenceStore: memoryStore(),
      fetchImpl,
    });

    renderAuthenticated(<AppInfoSection />, service, '/profile');

    await waitFor(() => {
      expect(screen.getByText(/Service Worker/i)).toBeInTheDocument();
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByText('Neue Version verfügbar')).not.toBeInTheDocument();
  });

  it('startet Auto-Check nicht während Login (kein User)', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(validManifest()), { status: 200 }));
    const service = new AppUpdateService({
      installedVersionCode: 10000,
      isNativeAndroidFn: () => true,
      preferenceStore: memoryStore(),
      fetchImpl,
    });

    renderAuthenticated(null, service, '/offers', null, false);

    await waitFor(() => {
      expect(screen.getByText('Produktive Seite')).toBeInTheDocument();
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByText('Neue Version verfügbar')).not.toBeInTheDocument();
  });

  it('Fetch-Fehler blockiert App nicht und zeigt kein Banner', async () => {
    const service = new AppUpdateService({
      installedVersionCode: 10000,
      isNativeAndroidFn: () => true,
      preferenceStore: memoryStore(),
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    vi.stubGlobal('navigator', { onLine: true });

    renderAuthenticated(null, service);

    await waitFor(() => {
      expect(screen.getByText('Produktive Seite')).toBeInTheDocument();
    });
    expect(screen.queryByText('Neue Version verfügbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('keine parallelen automatischen Prüfungen', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const store = memoryStore();
    const service = new AppUpdateService({
      installedVersionCode: 10000,
      isNativeAndroidFn: () => true,
      preferenceStore: store,
      fetchImpl: async () => {
        inflight += 1;
        maxInflight = Math.max(maxInflight, inflight);
        await new Promise((r) => setTimeout(r, 40));
        inflight -= 1;
        return new Response(JSON.stringify(validManifest()), { status: 200 });
      },
    });

    const first = service.checkForUpdate({ automatic: true });
    const second = service.checkForUpdate({ automatic: true });
    await Promise.all([first, second]);
    expect(maxInflight).toBe(1);
  });
});
