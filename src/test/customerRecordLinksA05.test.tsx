import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { createServices } from '../services';
import { createTestRepositories } from './helpers/createTestRepositories';
import { createUserContext } from '../services/auditService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, readStorageItem, writeStorageItem } from '../utils/storage';
import { createTestOffer, resetOfferTestSequence } from './helpers/offerTestHelpers';

function createHarness() {
  const repos = createTestRepositories();
  return {
    offerRepository: repos.offerRepository,
    salesTaskRepository: repos.salesTaskRepository,
    salesActivityRepository: repos.salesActivityRepository,
    services: createServices(repos),
  };
}

const owner = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' };
const field = createUserContext({
  id: 'user_001',
  name: 'Laura',
  role: 'field_service',
  status: 'active',
});

function renderAt(route: string) {
  writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('Aufräumblock 5 – Links zur Kundenakte', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    resetOfferTestSequence();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  afterEach(() => {
    cleanup();
  });

  it('OfferDetail verlinkt zur Kundenakte; Verträge und Aktivierung sind direkt erreichbar', async () => {
    const harness = createHarness();
    const offer = await harness.offerRepository.create(
      createTestOffer({
        workflowStatus: 'sent',
        leadId: 'lead_001',
        createdByUserId: owner.userId,
      }),
    );
    await harness.services.offerWorkflowService.ensureInitialVersion(offer);
    await harness.services.offerWorkflowService.acceptOffer(offer.id, owner, {
      acceptedByName: 'Kunde',
      acceptanceType: 'digital_confirmation',
      otherText: null,
      note: '',
    });
    const contract = await harness.services.contractService.getByOfferId(offer.id, field);
    expect(contract).toBeTruthy();
    if (!contract) return;
    const started = await harness.services.activationService.startFromContract(contract.id, field);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    cleanup();
    renderAt(`/offers/${offer.id}`);
    const offerLinks = await screen.findAllByRole('link', { name: 'Zur Kundenakte' });
    expect(offerLinks.some((link) => link.getAttribute('href') === '/leads/lead_001')).toBe(true);

    cleanup();
    const contractRouter = renderAt(`/contracts/${contract.id}`);
    expect(contractRouter.state.location.pathname).toBe(`/contracts/${contract.id}`);
    expect(
      await screen.findByRole('heading', { name: contract.contractNumber, level: 1 }),
    ).toBeInTheDocument();

    cleanup();
    const activationRouter = renderAt(`/activations/${started.value.id}`);
    expect(activationRouter.state.location.pathname).toBe(`/activations/${started.value.id}`);
    expect(
      await screen.findByRole('heading', { name: started.value.activationNumber, level: 1 }),
    ).toBeInTheDocument();
  });

  it('Rendern der Kundenakte erzeugt keine neuen Aufgaben oder Aktivitäten', async () => {
    const harness = createHarness();
    const beforeTasks = (readStorageItem<unknown[]>(STORAGE_KEYS.salesTasks) ?? []).length;
    const beforeActivities = (readStorageItem<unknown[]>(STORAGE_KEYS.salesActivities) ?? []).length;

    renderAt('/leads/lead_001');
    expect(
      await screen.findByRole('navigation', { name: 'Kundenakte Bereiche' }),
    ).toBeInTheDocument();

    expect((readStorageItem<unknown[]>(STORAGE_KEYS.salesTasks) ?? []).length).toBe(beforeTasks);
    expect((readStorageItem<unknown[]>(STORAGE_KEYS.salesActivities) ?? []).length).toBe(
      beforeActivities,
    );
    void harness;
  });
});
