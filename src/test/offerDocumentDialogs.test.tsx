import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { normalizeOfferDocuments } from '../domain/offerDocument/normalizeOfferDocument';
import { STORAGE_KEYS } from '../utils/storage';
import { FIELD_SERVICE_USER_ID } from './helpers/offerTestHelpers';
import {
  createOfferServicesForTests,
  seedOfferDocumentInStorage,
  seedPremiumLineCompletedOffer,
  setupOfferDocumentTestStorage,
} from './helpers/offerDocumentTestHelpers';

function getStoredDocuments() {
  const raw = localStorage.getItem(STORAGE_KEYS.offerDocuments);
  return raw ? normalizeOfferDocuments(JSON.parse(raw) as unknown[]) : [];
}

function renderAtRoute(initialRoute: string, resetData = true, currentUserId = FIELD_SERVICE_USER_ID) {
  if (resetData) {
    setupOfferDocumentTestStorage(currentUserId);
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

describe('Offer document dialogs UI', () => {
  beforeEach(() => {
    setupOfferDocumentTestStorage();
  });

  it('creates final pdf after confirmation', async () => {
    const user = userEvent.setup();
    setupOfferDocumentTestStorage();
    const offer = await seedPremiumLineCompletedOffer();

    renderAtRoute(`/offers/${offer.id}`, false);

    await user.click(await screen.findByRole('button', { name: 'Finales PDF erzeugen' }));
    expect(await screen.findByRole('heading', { name: 'Finales PDF erzeugen', level: 2 })).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: 'Finales PDF erzeugen' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(getStoredDocuments()).toHaveLength(1);
      expect(getStoredDocuments()[0]?.status).toBe('generated');
      expect(getStoredDocuments()[0]?.version).toBe(1);
    });

    expect(await screen.findByText('Aktuell')).toBeInTheDocument();
  });

  it('creates new version after confirmation and supersedes old document', async () => {
    const user = userEvent.setup();
    setupOfferDocumentTestStorage();
    const { offerDocumentRepository } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    const firstDocument = await seedOfferDocumentInStorage(offerDocumentRepository, offer, {
      id: 'offer_doc_v1',
      version: 1,
    });

    renderAtRoute(`/offers/${offer.id}`, false);

    await user.click(await screen.findByRole('button', { name: 'Neue Dokumentversion erzeugen' }));
    expect(
      await screen.findByRole('heading', { name: 'Neue Dokumentversion erzeugen', level: 2 }),
    ).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: 'Neue Dokumentversion erzeugen' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      const documents = getStoredDocuments();
      expect(documents).toHaveLength(2);
      expect(documents.find((entry) => entry.id === firstDocument.id)?.status).toBe('superseded');
      expect(documents.find((entry) => entry.status === 'generated')?.version).toBe(2);
    });
  });

  it('cancels final pdf dialog without creating document', async () => {
    const user = userEvent.setup();
    setupOfferDocumentTestStorage();
    const offer = await seedPremiumLineCompletedOffer();

    renderAtRoute(`/offers/${offer.id}`, false);

    await user.click(await screen.findByRole('button', { name: 'Finales PDF erzeugen' }));
    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => {
      expect(getStoredDocuments()).toHaveLength(0);
    });
  });
});
