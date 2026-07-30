import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { FIELD_SERVICE_USER_ID } from './helpers/offerTestHelpers';
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

  const view = render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );

  return { memoryRouter, view };
}

describe('Offer document detail UI', () => {
  beforeEach(() => {
    setupOfferDocumentTestStorage();
  });

  it('shows stored document metadata and integrity status', async () => {
    setupOfferDocumentTestStorage();
    const { offerDocumentRepository } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    const storedDocument = await seedOfferDocumentInStorage(offerDocumentRepository, offer, {
      id: 'offer_doc_detail',
    });

    renderAtRoute(`/offers/${offer.id}/documents/${storedDocument.id}`, false);

    await waitFor(() => {
      expect(screen.getByText('Dokumentmetadaten')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('heading', { level: 1, name: storedDocument.documentNumber }),
    ).toBeInTheDocument();
    expect(screen.getByText('Integrität geprüft')).toBeInTheDocument();
    expect(screen.getByText('Dokumentmetadaten')).toBeInTheDocument();
    expect(screen.getByText('Laura Berger')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'PDF herunterladen' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Zum Angebot' })).toHaveAttribute(
      'href',
      `/offers/${offer.id}`,
    );
  });

  it('shows pdf preview section on desktop', async () => {
    setupOfferDocumentTestStorage();
    const { offerDocumentRepository } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    const storedDocument = await seedOfferDocumentInStorage(offerDocumentRepository, offer, {
      id: 'offer_doc_preview',
    });

    const { view } = renderAtRoute(`/offers/${offer.id}/documents/${storedDocument.id}`, false);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'PDF-Vorschau' })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(view.container.querySelector('iframe')).toBeTruthy();
    });
  });

  it('shows not found for unknown document id', async () => {
    setupOfferDocumentTestStorage();
    const offer = await seedPremiumLineCompletedOffer();

    renderAtRoute(`/offers/${offer.id}/documents/offer_doc_missing`, false);

    expect(await screen.findByRole('heading', { level: 1, name: 'Dokument nicht gefunden' })).toBeInTheDocument();
  });

  it('shows preview page for draft offer', async () => {
    setupOfferDocumentTestStorage();
    const offer = await seedPremiumLineDraftOffer();

    renderAtRoute(`/offers/${offer.id}/preview`, false);

    await waitFor(() => {
      expect(screen.getByText(/Unverbindliche Vorschau/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 1, name: 'PDF-Vorschau' })).toBeInTheDocument();
  });
});
