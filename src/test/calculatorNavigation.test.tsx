import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { writeStorageItem, STORAGE_KEYS } from '../utils/storage';

function renderAtRoute(initialRoute: string, currentUserId = 'user_001') {
  clearDemoDataForTests();
  resetDemoDataForTests();
  writeStorageItem(STORAGE_KEYS.currentUserId, currentUserId);

  const memoryRouter = createMemoryRouter(appRoutes, {
    initialEntries: [initialRoute],
  });

  render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );

  return memoryRouter;
}

describe('Calculator navigation and access', () => {
  it('renders calculator for field service', async () => {
    renderAtRoute('/calculator', 'user_001');
    expect(await screen.findByRole('heading', { name: 'Beratung' })).toBeInTheDocument();
  });

  it('renders calculator for admin', async () => {
    renderAtRoute('/calculator', 'user_004');
    expect(await screen.findByRole('heading', { name: 'Beratung' })).toBeInTheDocument();
  });

  it('allows direct route access', async () => {
    renderAtRoute('/calculator');
    expect(await screen.findByLabelText('Anzahl angemieteter Terminals')).toBeInTheDocument();
  });
});
