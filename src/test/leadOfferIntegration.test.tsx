import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import {
  DEMO_LEAD_ID,
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

describe('Lead offer integration UI', () => {
  beforeEach(() => {
    setupOfferTestStorage();
  });

  it('shows offers section on lead detail', async () => {
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, {
      leadId: DEMO_LEAD_ID,
      title: 'Lead Angebot Alpha',
    });

    renderAtRoute(`/leads/${DEMO_LEAD_ID}`, false);
    expect(await screen.findByRole('heading', { name: 'Bestehende Angebote' })).toBeInTheDocument();
    expect(await screen.findByText(offer.offerNumber)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: new RegExp(offer.offerNumber) })).toHaveAttribute(
      'href',
      `/offers/${offer.id}`,
    );
  });

  it('shows empty state when lead has no offers', async () => {
    renderAtRoute(`/leads/${DEMO_LEAD_ID}`);
    expect(await screen.findByText('Noch kein Angebot erstellt.')).toBeInTheDocument();
  });

  it('links offer detail from lead page', async () => {
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, {
      leadId: DEMO_LEAD_ID,
      title: 'Verlinktes Angebot',
    });

    renderAtRoute(`/leads/${DEMO_LEAD_ID}`, false);
    expect(await screen.findByRole('link', { name: new RegExp(offer.offerNumber) })).toHaveAttribute(
      'href',
      `/offers/${offer.id}`,
    );
  });
});
