import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import {
  createProductSnapshotFromProduct,
  createTariffSnapshotFromTariff,
} from '../domain/offer/offerSnapshots';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import {
  createTestOfferItem,
  FIELD_SERVICE_USER_ID,
  getDemoProduct,
  getDemoTariff,
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

describe('Offer detail UI', () => {
  beforeEach(() => {
    setupOfferTestStorage();
  });

  it('shows offer details with totals', async () => {
    const user = userEvent.setup();
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    const product = getDemoProduct();
    const tariff = getDemoTariff();
    const offer = await seedOfferInStorage(repository, {
      title: 'Detail Test Angebot',
      tariffSnapshot: createTariffSnapshotFromTariff(tariff),
      items: [
        createTestOfferItem({
          productSnapshot: createProductSnapshotFromProduct(product, product.priceType, product.priceCents),
          name: product.name,
          priceType: 'monthly',
          unitPriceCents: product.priceCents,
          quantity: 1,
        }),
      ],
    });

    renderAtRoute(`/offers/${offer.id}`, false);

    expect(await screen.findByRole('heading', { name: 'Detail Test Angebot' })).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(offer.offerNumber)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Café Sonnenschein GmbH/).length).toBeGreaterThan(0);
    expect(screen.getByText(/BestPay Mobile A920 Classic/)).toBeInTheDocument();
    expect(screen.getByText('Monatliche Prognose')).toBeInTheDocument();
    expect(screen.getAllByText('137,85 € / Monat').length).toBeGreaterThan(0);
    expect(screen.getByText('Einmalige Kosten')).toBeInTheDocument();
    expect(screen.getByText('79,95 €')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Konditionen' }));
    expect(await screen.findByText(new RegExp(product.name))).toBeInTheDocument();
  });

  it('shows not found for unknown offer id', async () => {
    renderAtRoute('/offers/offer_unknown');

    expect(await screen.findByRole('heading', { level: 1, name: 'Angebot nicht gefunden' })).toBeInTheDocument();
  });

  it('shows edit action for draft offer', async () => {
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, { title: 'Bearbeitbar' });

    renderAtRoute(`/offers/${offer.id}`, false);

    expect(await screen.findByRole('link', { name: 'Bearbeiten' })).toHaveAttribute(
      'href',
      `/offers/${offer.id}/edit`,
    );
  });

  it('hides edit action for completed offer', async () => {
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, {
      title: 'Abgeschlossen Detail',
      status: 'completed',
      completedAt: '2026-08-01T10:00:00.000Z',
      completedByUserId: FIELD_SERVICE_USER_ID,
    });

    renderAtRoute(`/offers/${offer.id}`, false);

    expect(await screen.findByRole('heading', { name: 'Abgeschlossen Detail' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bearbeiten' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Als Entwurf duplizieren' })).toBeInTheDocument();
  });
});
