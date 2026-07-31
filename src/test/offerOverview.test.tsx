import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import {
  createTestOffer,
  FIELD_SERVICE_USER_ID,
  seedOfferInStorage,
  setupOfferTestStorage,
} from './helpers/offerTestHelpers';

function renderAtRoute(initialRoute: string, resetData = true, currentUserId = FIELD_SERVICE_USER_ID) {
  if (resetData) {
    setupOfferTestStorage(currentUserId);
  }

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

describe('Offer overview UI', () => {
  beforeEach(() => {
    setupOfferTestStorage();
  });

  it('shows offers list for field service', async () => {
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    await seedOfferInStorage(repository, {
      title: 'Premium Angebot Café',
      customerSnapshot: {
        ...createTestOffer().customerSnapshot,
        companyName: 'Café Sonnenschein GmbH',
      },
    });

    renderAtRoute('/offers', false);

    expect(await screen.findByRole('heading', { name: 'Angebote' })).toBeInTheDocument();
    expect(await screen.findByText('Premium Angebot Café')).toBeInTheDocument();
    expect(screen.getByText('Café Sonnenschein GmbH')).toBeInTheDocument();
  });

  it('shows create action', async () => {
    renderAtRoute('/offers');

    expect(await screen.findByRole('link', { name: 'Neues Angebot' })).toHaveAttribute(
      'href',
      '/offers/new',
    );
  });

  it('filters by search', async () => {
    const user = userEvent.setup();
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    await seedOfferInStorage(repository, { title: 'Alpha Angebot' });
    await seedOfferInStorage(repository, {
      title: 'Beta Angebot',
      createdByUserId: 'user_002',
    });

    renderAtRoute('/offers', false);

    await user.type(await screen.findByLabelText('Suche'), 'Alpha');

    await waitFor(() => {
      expect(screen.getByText('Alpha Angebot')).toBeInTheDocument();
      expect(screen.queryByText('Beta Angebot')).not.toBeInTheDocument();
    });
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    await seedOfferInStorage(repository, { title: 'Entwurf Angebot', status: 'draft' });
    await seedOfferInStorage(repository, {
      title: 'Abgeschlossen Angebot',
      status: 'completed',
      completedAt: '2026-08-01T10:00:00.000Z',
      completedByUserId: FIELD_SERVICE_USER_ID,
    });

    renderAtRoute('/offers', false);

    const statusGroup = await screen.findByRole('group', { name: 'Status' });
    await user.click(within(statusGroup).getByRole('button', { name: 'Entwurf' }));

    await waitFor(() => {
      expect(screen.getByText('Entwurf Angebot')).toBeInTheDocument();
      expect(screen.queryByText('Abgeschlossen Angebot')).not.toBeInTheDocument();
    });
  });

  it('shows owner filter for admin', async () => {
    renderAtRoute('/offers', true, 'user_004');

    expect(await screen.findByRole('button', { name: 'Meine Angebote' })).toBeInTheDocument();
  });

  it('shows empty state when no matches', async () => {
    const user = userEvent.setup();
    renderAtRoute('/offers');

    await user.type(await screen.findByLabelText('Suche'), 'NichtVorhanden123');

    expect(await screen.findByText('Keine Angebote gefunden')).toBeInTheDocument();
  });
});
