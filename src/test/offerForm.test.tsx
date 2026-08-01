import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { normalizeOffers } from '../domain/offer/normalizeOffer';
import { STORAGE_KEYS } from '../utils/storage';
import {
  DEMO_LEAD_ID,
  DEMO_TARIFF_ID,
  FIELD_SERVICE_USER_ID,
  setupOfferTestStorage,
} from './helpers/offerTestHelpers';
import { selectFormOptionByValue } from './helpers/selectFormOption';

function getStoredOffers() {
  const raw = localStorage.getItem(STORAGE_KEYS.offers);
  return raw ? normalizeOffers(JSON.parse(raw) as unknown[]) : [];
}

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

describe('Offer form UI', () => {
  beforeEach(() => {
    setupOfferTestStorage();
  });

  it('validates required fields on create', async () => {
    const user = userEvent.setup();
    renderAtRoute('/offers/new');

    await selectFormOptionByValue(user, 'Lead', DEMO_LEAD_ID);
    await user.click(screen.getByRole('button', { name: 'Angebot speichern' }));

    expect(
      await screen.findByText('Bitte wählen Sie mindestens einen Payment-Tarif oder eine Position aus.'),
    ).toBeInTheDocument();
  });

  it('creates offer with tariff and navigates to detail', async () => {
    const user = userEvent.setup();
    renderAtRoute('/offers/new');

    await selectFormOptionByValue(user, 'Lead', DEMO_LEAD_ID);
    await selectFormOptionByValue(user, 'Tarif', DEMO_TARIFF_ID);
    await user.click(screen.getByRole('button', { name: 'Angebot speichern' }));

    await waitFor(() => {
      expect(getStoredOffers().length).toBe(1);
    });

    const created = getStoredOffers()[0]!;
    expect(created.leadId).toBe(DEMO_LEAD_ID);
    expect(created.tariffSnapshot?.tariffId).toBe(DEMO_TARIFF_ID);
    expect(created.status).toBe('draft');

    renderAtRoute(`/offers/${created.id}`, false);
    expect(await screen.findByRole('heading', { name: 'BestPay Angebot' })).toBeInTheDocument();
  });

  it('prefills lead from query parameter', async () => {
    renderAtRoute(`/offers/new?leadId=${DEMO_LEAD_ID}`);

    expect(await screen.findByLabelText('Lead')).toHaveAttribute('data-value', DEMO_LEAD_ID);
  });

  it('adds product from catalog and saves offer', async () => {
    const user = userEvent.setup();
    renderAtRoute('/offers/new');

    await selectFormOptionByValue(user, 'Lead', DEMO_LEAD_ID);
    await user.click(
      await screen.findByRole('button', { name: /BestPay Premium Line Kassensystem/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Angebot speichern' }));

    await waitFor(() => {
      const offers = getStoredOffers();
      expect(offers.length).toBe(1);
      expect(offers[0]?.items.length).toBeGreaterThan(0);
    });
  });

  it('shows cancel dialog when form is dirty', async () => {
    const user = userEvent.setup();
    renderAtRoute('/offers/new');

    await selectFormOptionByValue(user, 'Lead', DEMO_LEAD_ID);
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
  });
});
