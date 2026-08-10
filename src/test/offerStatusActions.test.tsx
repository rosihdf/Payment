import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { normalizeOffers } from '../domain/offer/normalizeOffer';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { STORAGE_KEYS } from '../utils/storage';
import {
  FIELD_SERVICE_USER_ID,
  seedOfferInStorage,
  setupOfferTestStorage,
} from './helpers/offerTestHelpers';

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

describe('Offer status actions UI', () => {
  beforeEach(() => {
    setupOfferTestStorage();
  });

  it('completes draft offer', async () => {
    const user = userEvent.setup();
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, {
      title: 'Abschluss Test',
      workflowStatus: 'sent',
      currentVersionId: 'ver_complete_test',
      currentVersionNumber: 1,
    });

    renderAtRoute(`/offers/${offer.id}`, false);

    await user.click(await screen.findByRole('button', { name: 'Abschließen' }));
    await user.click(await screen.findByRole('button', { name: 'Angebot abschließen' }));

    await waitFor(() => {
      expect(getStoredOffers()[0]?.status).toBe('completed');
    });

    expect(await screen.findByText('Angenommen')).toBeInTheDocument();
  });

  it('cancels offer with reason', async () => {
    const user = userEvent.setup();
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, { title: 'Storno Test' });

    renderAtRoute(`/offers/${offer.id}`, false);

    await user.type(await screen.findByLabelText('Stornierungsgrund'), 'Kunde hat abgesagt');
    await user.click(screen.getByRole('button', { name: 'Stornieren' }));
    await user.click(await screen.findByRole('button', { name: 'Angebot stornieren' }));

    await waitFor(() => {
      expect(getStoredOffers()[0]?.status).toBe('cancelled');
      expect(getStoredOffers()[0]?.cancellationReason).toBe('Kunde hat abgesagt');
    });
  });

  it('duplicates completed offer as draft', async () => {
    const user = userEvent.setup();
    setupOfferTestStorage();
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, {
      title: 'Duplikat Quelle',
      status: 'completed',
      completedAt: '2026-08-01T10:00:00.000Z',
      completedByUserId: FIELD_SERVICE_USER_ID,
    });

    renderAtRoute(`/offers/${offer.id}`, false);

    await user.click(await screen.findByRole('button', { name: 'Als Entwurf duplizieren' }));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Als Entwurf duplizieren' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(getStoredOffers().length).toBe(2);
      expect(getStoredOffers().some((entry) => entry.status === 'draft')).toBe(true);
    });

    const duplicate = getStoredOffers().find((entry) => entry.status === 'draft' && entry.id !== offer.id);
    expect(duplicate).toBeTruthy();
  });
});
