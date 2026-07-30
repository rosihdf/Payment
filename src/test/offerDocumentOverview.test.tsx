import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import {
  FIELD_SERVICE_USER_ID,
  seedOfferInStorage,
} from './helpers/offerTestHelpers';
import {
  createOfferServicesForTests,
  seedOfferDocumentInStorage,
  seedPremiumLineCompletedOffer,
  seedPremiumLineDraftOffer,
  setupOfferDocumentTestStorage,
} from './helpers/offerDocumentTestHelpers';

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

describe('Offer document overview UI', () => {
  beforeEach(() => {
    setupOfferDocumentTestStorage();
  });

  it('shows PDF documents section on offer detail', async () => {
    setupOfferDocumentTestStorage();
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, { title: 'Dokument Test Angebot' });

    renderAtRoute(`/offers/${offer.id}`, false);

    expect(await screen.findByRole('heading', { name: 'PDF-Dokumente' })).toBeInTheDocument();
    expect(
      await screen.findByText('Für dieses Angebot wurden noch keine finalen PDF-Dokumente gespeichert.'),
    ).toBeInTheDocument();
  });

  it('shows preview action for draft offer', async () => {
    setupOfferDocumentTestStorage();
    const offer = await seedPremiumLineDraftOffer();

    renderAtRoute(`/offers/${offer.id}`, false);

    expect(await screen.findByRole('link', { name: 'PDF-Vorschau' })).toHaveAttribute(
      'href',
      `/offers/${offer.id}/preview`,
    );
  });

  it('shows create final action for completed offer without document', async () => {
    setupOfferDocumentTestStorage();
    const offer = await seedPremiumLineCompletedOffer();

    renderAtRoute(`/offers/${offer.id}`, false);

    expect(await screen.findByRole('button', { name: 'Finales PDF erzeugen' })).toBeInTheDocument();
  });

  it('lists stored documents with status badge', async () => {
    setupOfferDocumentTestStorage();
    const { offerDocumentRepository } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    const document = await seedOfferDocumentInStorage(offerDocumentRepository, offer, {
      id: 'offer_doc_ui_list',
    });

    renderAtRoute(`/offers/${offer.id}`, false);

    expect(await screen.findByText(document.documentNumber)).toBeInTheDocument();
    expect(screen.getByText('Aktuell')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Details anzeigen' })).toHaveAttribute(
      'href',
      `/offers/${offer.id}/documents/${document.id}`,
    );
  });

  it('hides preview action for cancelled offer', async () => {
    setupOfferDocumentTestStorage();
    const { offerService } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    await offerService.cancelOffer(offer.id, 'Kunde hat abgesagt', {
      userId: FIELD_SERVICE_USER_ID,
      role: 'field_service',
      displayName: 'Laura Berger',
    });

    renderAtRoute(`/offers/${offer.id}`, false);

    expect(await screen.findByRole('heading', { name: 'PDF-Dokumente' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'PDF-Vorschau' })).not.toBeInTheDocument();
  });

  it('shows new version action when current document exists', async () => {
    setupOfferDocumentTestStorage();
    const { offerDocumentRepository } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    await seedOfferDocumentInStorage(offerDocumentRepository, offer, { id: 'offer_doc_current' });

    renderAtRoute(`/offers/${offer.id}`, false);

    expect(await screen.findByRole('button', { name: 'Neue Dokumentversion erzeugen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finales PDF erzeugen' })).not.toBeInTheDocument();
  });
});
