import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppUpdateProvider } from '../app/providers/AppUpdateProvider';
import { AppUpdateGate } from '../features/appUpdate/AppUpdateGate';
import { AppInfoSection } from '../features/profile/AppInfoSection';
import { AppUpdateService } from '../services/appUpdateService';

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    versionName: '1.0.1',
    versionCode: 10001,
    minimumVersionCode: 10000,
    mandatory: false,
    downloadUrl: 'https://example.com/AMRtech-Payment-1.0.1.apk',
    sha256: 'b'.repeat(64),
    sizeBytes: 2048,
    publishedAt: '2026-08-02T20:00:00.000Z',
    releaseNotes: 'Updatefunktion und Downloadhinweis.',
    releaseTag: 'android-1.0.1',
    sourceCommit: '4a8d369a8245592b7d74cab481e3872289cc0f54',
    ...overrides,
  };
}

function renderWithUpdate(
  ui: React.ReactNode,
  service: AppUpdateService,
  initialPath = '/offers',
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppUpdateProvider service={service}>
        <AppUpdateGate>
          <Routes>
            <Route path="/profile" element={<div>{ui}</div>} />
            <Route path="*" element={<div>Produktive Seite</div>} />
          </Routes>
        </AppUpdateGate>
      </AppUpdateProvider>
    </MemoryRouter>,
  );
}

describe('App-Update UI', () => {
  it('zeigt manuellen Check, Download und Später nur bei optionalem Update', async () => {
    const user = userEvent.setup();
    const service = new AppUpdateService({
      installedVersionCode: 10000,
      installedVersionName: '1.0.0',
      isNativeAndroidFn: () => true,
      fetchImpl: async () => new Response(JSON.stringify(validManifest()), { status: 200 }),
    });

    renderWithUpdate(<AppInfoSection />, service, '/profile');

    await waitFor(() => {
      expect(screen.getByText('Update verfügbar')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Jetzt prüfen' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Update herunterladen' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: 'Später' }).length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getAllByRole('button', { name: 'Später' })[0]!);
    await waitFor(() => {
      expect(screen.queryByText(/Update verfügbar:/)).not.toBeInTheDocument();
    });
  });

  it('blockiert Pflichtupdate nicht wegklickbar außerhalb der App-Info', async () => {
    const service = new AppUpdateService({
      installedVersionCode: 10000,
      installedVersionName: '1.0.0',
      isNativeAndroidFn: () => true,
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ mandatory: true })), { status: 200 }),
    });

    renderWithUpdate(<AppInfoSection />, service, '/offers');

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
    expect(screen.getByText('Pflichtupdate erforderlich')).toBeInTheDocument();
    expect(screen.queryByText('Produktive Seite')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Später' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'App-Info öffnen' })).toBeInTheDocument();
  });

  it('lässt App-Info bei Pflichtupdate erreichbar', async () => {
    const service = new AppUpdateService({
      installedVersionCode: 10000,
      installedVersionName: '1.0.0',
      isNativeAndroidFn: () => true,
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ mandatory: true })), { status: 200 }),
    });

    renderWithUpdate(<AppInfoSection />, service, '/profile');

    await waitFor(() => {
      expect(screen.getByText('Pflichtupdate')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update herunterladen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Später' })).not.toBeInTheDocument();
  });

  it('führt im Web keinen APK-Check aus', async () => {
    const fetchImpl = vi.fn();
    const service = new AppUpdateService({
      isNativeAndroidFn: () => false,
      fetchImpl,
    });

    renderWithUpdate(<AppInfoSection />, service, '/profile');

    await waitFor(() => {
      expect(screen.getByText(/Service Worker/i)).toBeInTheDocument();
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
