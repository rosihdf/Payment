import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

const VIEWPORTS = [360, 390, 412, 768, 960, 1280] as const;

function renderAt(route: string) {
  writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

function assertNoHorizontalOverflow(label: string) {
  const root = document.documentElement;
  const body = document.body;
  expect(root.scrollWidth, `${label}: html overflow`).toBeLessThanOrEqual(root.clientWidth + 1);
  expect(body.scrollWidth, `${label}: body overflow`).toBeLessThanOrEqual(body.clientWidth + 1);
}

describe('v2 responsive viewports', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  afterEach(() => {
    cleanup();
    document.documentElement.style.width = '';
    document.body.style.width = '';
  });

  for (const width of VIEWPORTS) {
    it(`hält Arbeitsplatz bei ${width}px ohne unkontrollierten Overflow`, async () => {
      document.documentElement.style.width = `${width}px`;
      document.body.style.width = `${width}px`;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      renderAt('/sales');
      expect(await screen.findByRole('heading', { name: 'Arbeitsplatz', level: 1 })).toBeInTheDocument();
      assertNoHorizontalOverflow(`/sales@${width}`);
    });

    it(`hält Kundenliste bei ${width}px ohne unkontrollierten Overflow`, async () => {
      document.documentElement.style.width = `${width}px`;
      document.body.style.width = `${width}px`;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      renderAt('/leads');
      expect(await screen.findByRole('heading', { name: 'Kunden', level: 1 })).toBeInTheDocument();
      assertNoHorizontalOverflow(`/leads@${width}`);
    });
  }

  it('hält Beratungshub und Kundenakte ohne Overflow bei 360px', async () => {
    document.documentElement.style.width = '360px';
    document.body.style.width = '360px';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });
    renderAt('/advice');
    expect(await screen.findByRole('heading', { name: 'Beratung', level: 1 })).toBeInTheDocument();
    assertNoHorizontalOverflow('/advice@360');
    cleanup();
    renderAt('/leads/lead_001');
    expect(
      await screen.findByRole('navigation', { name: 'Kundenakte Bereiche' }),
    ).toBeInTheDocument();
    assertNoHorizontalOverflow('/leads/lead_001@360');
  });
});
