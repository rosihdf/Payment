import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import {
  FIELD_SERVICE_USER_ID,
  seedOfferInStorage,
  setupOfferTestStorage,
} from './helpers/offerTestHelpers';
import { selectFormOptionByValue } from './helpers/selectFormOption';

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

describe('Offer navigation', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setupOfferTestStorage();
  });

  it('renders offers overview route', async () => {
    renderAtRoute('/offers');

    expect(await screen.findByRole('heading', { name: 'Angebote' })).toBeInTheDocument();
  });

  it('renders new offer route', async () => {
    renderAtRoute('/offers/new');

    expect(await screen.findByRole('heading', { name: 'Neues Angebot' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Angebot speichern' })).toBeEnabled();
  });

  it('renders offer detail route', async () => {
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, { title: 'Routing Detail' });

    renderAtRoute(`/offers/${offer.id}`, false);

    expect(await screen.findByRole('heading', { name: 'Routing Detail' })).toBeInTheDocument();
  });

  it('renders offer edit route for draft', async () => {
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, { title: 'Routing Edit' });

    renderAtRoute(`/offers/${offer.id}/edit`, false);

    expect(await screen.findByRole('heading', { name: 'Angebot bearbeiten' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Änderungen speichern' })).toBeEnabled();
  });

  it('shows not found for unknown offer id', async () => {
    renderAtRoute('/offers/offer_unknown');

    expect(await screen.findByRole('heading', { level: 1, name: 'Angebot nicht gefunden' })).toBeInTheDocument();
  });

  it('discards changes from leave dialog on new offer', async () => {
    const user = userEvent.setup();
    renderAtRoute('/offers/new');

    await selectFormOptionByValue(user, 'Lead', 'lead_001');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await user.click(await screen.findByRole('button', { name: 'Änderungen verwerfen' }));

    expect(navigateMock).toHaveBeenCalledWith('/offers', { replace: true });
  });
});
