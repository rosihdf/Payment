import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { createServices } from '../services';
import { createUserContext } from '../services/auditService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { createTestRepositories } from './helpers/createTestRepositories';
import { confirmCounselingAndDocumentSent, createTestOffer, FIELD_SERVICE_CONTEXT } from './helpers/offerTestHelpers';

const VIEWPORTS = [360, 390, 412, 768, 960, 1280] as const;

const REVIEWER_CONTEXT = { userId: 'user_004', role: 'admin' as const, displayName: 'Admin' };
const FIELD_USER_CONTEXT = createUserContext({
  id: 'user_001',
  role: 'field_service',
  name: 'Laura Berger',
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

function renderAtAs(route: string, userId: string) {
  writeStorageItem(STORAGE_KEYS.currentUserId, userId);
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

/**
 * Erzeugt über die echten Services (nicht die UI) ein akzeptiertes Angebot,
 * einen Vertrag und eine gestartete Aktivierung – analog zu
 * `activationManagementD.test.ts` – damit `/offers/:id`, `/contracts/:contractId`
 * und `/activations/:activationId` mit realen Datensätzen geladen werden können.
 */
async function seedOfferContractActivationPipeline() {
  const repos = createTestRepositories();
  const services = createServices(repos);
  const workflow = services.offerWorkflowService;

  let offer = await repos.offerRepository.create(
    createTestOffer({ workflowStatus: 'approval_required' }),
  );
  offer = await workflow.ensureInitialVersion(offer);
  await workflow.approve(offer.id, REVIEWER_CONTEXT);
  await workflow.markReadyToSend(offer.id, FIELD_SERVICE_CONTEXT);
  await confirmCounselingAndDocumentSent(workflow, offer.id, FIELD_SERVICE_CONTEXT);
  const accepted = await workflow.acceptOffer(offer.id, FIELD_SERVICE_CONTEXT, {
    acceptedByName: 'Kunde',
    acceptanceType: 'email_confirmation',
    otherText: null,
    note: 'ok',
  });
  if (!accepted.ok) {
    throw new Error('Testvorbereitung: Angebot konnte nicht akzeptiert werden');
  }

  const contractResult = await services.contractService.createFromAcceptedOffer(
    accepted.offer.id,
    FIELD_USER_CONTEXT,
  );
  if (!contractResult.ok) {
    throw new Error('Testvorbereitung: Vertrag konnte nicht angelegt werden');
  }

  const activationResult = await services.activationService.startFromContract(
    contractResult.value.id,
    FIELD_USER_CONTEXT,
  );
  if (!activationResult.ok) {
    throw new Error('Testvorbereitung: Aktivierung konnte nicht gestartet werden');
  }

  return {
    offerId: accepted.offer.id,
    offerTitle: accepted.offer.title,
    contractId: contractResult.value.id,
    contractNumber: contractResult.value.contractNumber,
    activationId: activationResult.value.id,
    activationNumber: activationResult.value.activationNumber,
  };
}

function assertNoHorizontalOverflow(label: string) {
  const root = document.documentElement;
  const body = document.body;
  expect(root.scrollWidth, `${label}: html overflow`).toBeLessThanOrEqual(root.clientWidth + 1);
  expect(body.scrollWidth, `${label}: body overflow`).toBeLessThanOrEqual(body.clientWidth + 1);
}

describe('v2 responsive viewports', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  afterEach(() => {
    cleanup();
    document.documentElement.style.width = '';
    document.body.style.width = '';
  });

  for (const width of VIEWPORTS) {
    it(`hält Arbeitsplatz bei ${width}px ohne unkontrollierten Overflow`, async () => {
      document.documentElement.style.width = `${width}px`;
      document.body.style.width = `${width}px`;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      renderAt('/sales');
      expect(await screen.findByRole('heading', { name: 'Arbeitsplatz', level: 1 })).toBeInTheDocument();
      assertNoHorizontalOverflow(`/sales@${width}`);
    });

    it(`hält Kundenliste bei ${width}px ohne unkontrollierten Overflow`, async () => {
      document.documentElement.style.width = `${width}px`;
      document.body.style.width = `${width}px`;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      renderAt('/leads');
      expect(await screen.findByRole('heading', { name: 'Kunden', level: 1 })).toBeInTheDocument();
      assertNoHorizontalOverflow(`/leads@${width}`);
    });
  }

  it('hält Beratungshub und Kundenakte ohne Overflow bei 360px', async () => {
    document.documentElement.style.width = '360px';
    document.body.style.width = '360px';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });
    renderAt('/advice');
    expect(await screen.findByRole('heading', { name: 'Beratung', level: 1 })).toBeInTheDocument();
    assertNoHorizontalOverflow('/advice@360');
    cleanup();
    renderAt('/leads/lead_001');
    expect(
      await screen.findByRole('navigation', { name: 'Kundenakte Bereiche' }),
    ).toBeInTheDocument();
    assertNoHorizontalOverflow('/leads/lead_001@360');
  });
});

describe('v2 responsive viewports – neu geroutete Seiten (Angebot, Vertrag, Aktivierung, Lead, Admin, Provision)', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  afterEach(() => {
    cleanup();
    document.documentElement.style.width = '';
    document.body.style.width = '';
  });

  function setViewportWidth(width: number) {
    document.documentElement.style.width = `${width}px`;
    document.body.style.width = `${width}px`;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  }

  for (const width of VIEWPORTS) {
    it(`hält Angebotsdetail bei ${width}px ohne unkontrollierten Overflow`, async () => {
      const pipeline = await seedOfferContractActivationPipeline();
      setViewportWidth(width);
      renderAt(`/offers/${pipeline.offerId}`);
      expect(
        await screen.findByRole('heading', { name: pipeline.offerTitle, level: 1 }),
      ).toBeInTheDocument();
      assertNoHorizontalOverflow(`/offers/:id@${width}`);
    });

    it(`hält Vertragsdetail bei ${width}px ohne unkontrollierten Overflow`, async () => {
      const pipeline = await seedOfferContractActivationPipeline();
      setViewportWidth(width);
      renderAt(`/contracts/${pipeline.contractId}`);
      expect(
        await screen.findByRole('heading', { name: pipeline.contractNumber, level: 1 }),
      ).toBeInTheDocument();
      assertNoHorizontalOverflow(`/contracts/:contractId@${width}`);
    });

    it(`hält Aktivierungsdetail bei ${width}px ohne unkontrollierten Overflow`, async () => {
      const pipeline = await seedOfferContractActivationPipeline();
      setViewportWidth(width);
      renderAt(`/activations/${pipeline.activationId}`);
      expect(
        await screen.findByRole('heading', { name: pipeline.activationNumber, level: 1 }),
      ).toBeInTheDocument();
      assertNoHorizontalOverflow(`/activations/:activationId@${width}`);
    });

    it(`hält "Neuen Kunden aufnehmen" bei ${width}px ohne unkontrollierten Overflow`, async () => {
      setViewportWidth(width);
      renderAt('/leads/new');
      expect(
        await screen.findByRole('heading', { name: 'Neuen Kunden aufnehmen', level: 1 }),
      ).toBeInTheDocument();
      assertNoHorizontalOverflow(`/leads/new@${width}`);
    });

    it(`hält Admin-Benutzerverwaltung bei ${width}px ohne unkontrollierten Overflow`, async () => {
      setViewportWidth(width);
      renderAtAs('/admin/users', 'user_004');
      expect(await screen.findByRole('heading', { name: 'Benutzer', level: 1 })).toBeInTheDocument();
      assertNoHorizontalOverflow(`/admin/users@${width}`);
    });

    it(`hält Admin-Katalog (Produkte & Konditionen) bei ${width}px ohne unkontrollierten Overflow`, async () => {
      setViewportWidth(width);
      renderAtAs('/admin/catalog', 'user_004');
      expect(
        await screen.findByRole('heading', { name: 'Produkte & Konditionen', level: 1 }),
      ).toBeInTheDocument();
      assertNoHorizontalOverflow(`/admin/catalog@${width}`);
    });

    it(`hält Provisionsübersicht bei ${width}px ohne unkontrollierten Overflow`, async () => {
      setViewportWidth(width);
      renderAtAs('/admin/commission/overview', 'user_004');
      expect(
        await screen.findByRole('heading', { name: 'Provision – Übersicht', level: 1 }),
      ).toBeInTheDocument();
      assertNoHorizontalOverflow(`/admin/commission/overview@${width}`);
    });
  }
});
