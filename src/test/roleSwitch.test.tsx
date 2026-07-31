import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';

function renderApp() {
  clearDemoDataForTests();
  resetDemoDataForTests();

  const memoryRouter = createMemoryRouter(appRoutes, {
    initialEntries: ['/'],
  });

  return render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );
}

describe('Role switching', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('updates role label on dashboard after switching to admin', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByText('Außendienst')).toBeInTheDocument();

    const roleSelect = await screen.findByLabelText('Demo-Benutzer');
    await waitFor(() => {
      expect(roleSelect.querySelectorAll('option').length).toBeGreaterThan(0);
    });

    await user.selectOptions(roleSelect, 'user_004');

    expect(await screen.findByText('Demo-Benutzer: Michael Weber (Administrator)')).toBeInTheDocument();
    expect(screen.getAllByText('Administrator').length).toBeGreaterThan(0);
  });

  it('persists selected admin user in role switcher', async () => {
    const user = userEvent.setup();
    renderApp();

    const roleSelect = await screen.findByLabelText('Demo-Benutzer');
    await waitFor(() => {
      expect(roleSelect.querySelectorAll('option').length).toBeGreaterThan(0);
    });

    await user.selectOptions(roleSelect, 'user_004');

    expect(roleSelect).toHaveValue('user_004');
    expect(screen.getByRole('option', { name: 'Michael Weber (Administrator)' })).toBeInTheDocument();
  });
});
