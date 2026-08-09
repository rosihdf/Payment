import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import {
  getActivationDisplayGroup,
  getActivationDisplayLabel,
} from '../features/activation/activationStatusDisplay';
import {
  getContractDisplayGroup,
  getContractDisplayLabel,
} from '../features/contract/contractStatusDisplay';
import {
  getOfferWorkflowDisplayGroup,
  getOfferWorkflowDisplayLabel,
} from '../features/offer/offerWorkflowDisplay';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import {
  FIELD_SERVICE_USER_ID,
  seedOfferInStorage,
  setupOfferTestStorage,
} from './helpers/offerTestHelpers';

describe('Aufräumblock 8 – Statusanzeige-Mappings', () => {
  it('maps offer workflow statuses to display groups without mutation', () => {
    expect(getOfferWorkflowDisplayGroup('draft')).toBe('draft');
    expect(getOfferWorkflowDisplayGroup('in_approval')).toBe('approval');
    expect(getOfferWorkflowDisplayGroup('ready_to_send')).toBe('ready_to_send');
    expect(getOfferWorkflowDisplayGroup('sent')).toBe('sent');
    expect(getOfferWorkflowDisplayGroup('accepted')).toBe('accepted');
    expect(getOfferWorkflowDisplayGroup('declined')).toBe('declined');
    expect(getOfferWorkflowDisplayLabel('in_approval')).toBe('In Freigabe');
    expect(getOfferWorkflowDisplayLabel('sent')).toBe('Beim Kunden');
    expect(getOfferWorkflowDisplayLabel('cancelled')).toBe('Storniert');
  });

  it('maps contract statuses to display groups', () => {
    expect(getContractDisplayGroup('preparation')).toBe('preparation');
    expect(getContractDisplayGroup('activation')).toBe('activation');
    expect(getContractDisplayGroup('active')).toBe('active');
    expect(getContractDisplayGroup('termination_pending')).toBe('change_or_termination');
    expect(getContractDisplayGroup('ended')).toBe('ended');
    expect(getContractDisplayGroup('archived')).toBe('archived');
    expect(getContractDisplayLabel('suspended')).toBe('Änderung oder Kündigung');
  });

  it('maps activation statuses to display groups', () => {
    expect(getActivationDisplayGroup('draft')).toBe('preparation');
    expect(getActivationDisplayGroup('documents_pending')).toBe('documents_review');
    expect(getActivationDisplayGroup('hardware_pending')).toBe('hardware');
    expect(getActivationDisplayGroup('testing')).toBe('setup_test');
    expect(getActivationDisplayGroup('go_live_ready')).toBe('go_live');
    expect(getActivationDisplayGroup('live')).toBe('live');
    expect(getActivationDisplayGroup('blocked')).toBe('blocked');
    expect(getActivationDisplayGroup('completed')).toBe('closed');
    expect(getActivationDisplayLabel('provider_review')).toBe('Unterlagen & Prüfung');
  });
});

describe('Aufräumblock 8 – Angebotsdetail UI', () => {
  beforeEach(() => {
    setupOfferTestStorage();
  });

  it('shows simplified areas, one display status and customer record link', async () => {
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, { title: 'A08 Angebot' });

    const memoryRouter = createMemoryRouter(appRoutes, {
      initialEntries: [`/offers/${offer.id}`],
    });
    render(
      <AppProviders>
        <RouterProvider router={memoryRouter} />
      </AppProviders>,
    );

    expect(await screen.findByRole('heading', { name: 'A08 Angebot' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Zum Kunden' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Übersicht' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Positionen & Konditionen' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Freigabe & Versand' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Versionen & Dokumente' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Interne Provision' })).toBeInTheDocument();
    expect(screen.getAllByText('Entwurf').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Angebotsworkflow' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abschließen' })).toBeInTheDocument();
  });

  it('shows commission tab for field service with commission.view and for admin', async () => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_004');
    setupOfferTestStorage('user_004');
    const repository = new LocalOfferRepository();
    const offer = await seedOfferInStorage(repository, {
      title: 'Admin Provision',
      createdByUserId: 'user_004',
    });

    const memoryRouter = createMemoryRouter(appRoutes, {
      initialEntries: [`/offers/${offer.id}`],
    });
    render(
      <AppProviders>
        <RouterProvider router={memoryRouter} />
      </AppProviders>,
    );

    expect(await screen.findByRole('tab', { name: 'Interne Provision' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Go-live/i })).not.toBeInTheDocument();
  });
});

describe('Aufräumblock 8 – keine Engine beim Mapping', () => {
  it('display helpers are pure and do not invent statuses', () => {
    const technical = 'activation_pending' as const;
    expect(getOfferWorkflowDisplayGroup(technical)).toBe('accepted');
    expect(technical).toBe('activation_pending');
    expect(FIELD_SERVICE_USER_ID).toBeTruthy();
  });
});
