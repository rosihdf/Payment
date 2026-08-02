import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { leadToEditInput } from '../domain/lead/leadFormMapping';
import type { Lead } from '../domain/lead/lead';
import { formatCentsToCurrency } from '../utils/currency';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { selectFormOptionByValue } from './helpers/selectFormOption';
import { createTestLead } from './helpers/leadTestHelpers';

function seedCustomLeads(leads: Lead[], currentUserId = 'user_001') {
  clearDemoDataForTests();
  resetDemoDataForTests();
  writeStorageItem(STORAGE_KEYS.leads, leads);
  writeStorageItem(STORAGE_KEYS.currentUserId, currentUserId);
}

function renderAtRoute(initialRoute: string, currentUserId = 'user_001', useDemoSeed = true) {
  if (useDemoSeed) {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, currentUserId);
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

function getStoredLeads(): Lead[] {
  const raw = localStorage.getItem(STORAGE_KEYS.leads);
  return raw ? (JSON.parse(raw) as Lead[]) : [];
}

describe('Lead edit UI', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('prefills existing values including cents and status', async () => {
    const lead = createTestLead({
      id: 'lead_edit_ui',
      companyName: 'Vorbelegt GmbH',
      contactFirstName: 'Erika',
      contactLastName: 'Vorbelegt',
      monthlyCardTurnoverCents: 150000,
      status: 'contacted',
      assignedSalesUserId: 'user_001',
      createdByUserId: 'user_001',
    });

    seedCustomLeads([lead]);
    renderAtRoute('/leads/lead_edit_ui/edit', 'user_001', false);

    expect(await screen.findByLabelText('Firmenname')).toHaveValue('Vorbelegt GmbH');
    expect(screen.getByLabelText('Vorname')).toHaveValue('Erika');
    expect(screen.getByLabelText('Nachname')).toHaveValue('Vorbelegt');
    expect(screen.getByLabelText('Monatlicher Kartenumsatz')).toHaveValue(
      formatCentsToCurrency(150000),
    );
    expect(screen.getByLabelText('Status')).toHaveTextContent('Kontaktiert');
  });

  it('shows empty optional fields instead of placeholders', async () => {
    const lead = createTestLead({
      id: 'lead_empty_optional',
      email: '',
      city: '',
      notes: '',
      assignedSalesUserId: 'user_001',
      createdByUserId: 'user_001',
    });

    seedCustomLeads([lead]);
    renderAtRoute('/leads/lead_empty_optional/edit', 'user_001', false);

    expect(await screen.findByLabelText('E-Mail')).toHaveValue('');
    expect(screen.getByLabelText('Ort')).toHaveValue('');
    expect(screen.getByLabelText('Notizen')).toHaveValue('');
  });

  it('saves changes and shows them on the detail page', async () => {
    const user = userEvent.setup();
    const lead = createTestLead({
      id: 'lead_save_ui',
      companyName: 'Alt GmbH',
      assignedSalesUserId: 'user_001',
      createdByUserId: 'user_001',
    });
    seedCustomLeads([lead]);
    renderAtRoute('/leads/lead_save_ui/edit', 'user_001', false);

    const companyField = await screen.findByLabelText('Firmenname');
    await user.clear(companyField);
    await user.type(companyField, 'Neu GmbH');
    await selectFormOptionByValue(user, 'Status', 'offer');
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(getStoredLeads().find((item) => item.id === 'lead_save_ui')?.companyName).toBe(
        'Neu GmbH',
      );
    });

    renderAtRoute('/leads/lead_save_ui', 'user_001', false);

    expect((await screen.findAllByRole('heading', { name: 'Neu GmbH' })).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Angebote')).length).toBeGreaterThan(0);
  });

  it('shows AccessDenied for foreign lead edit url', async () => {
    const lead = createTestLead({
      id: 'lead_foreign_ui',
      assignedSalesUserId: 'user_002',
      createdByUserId: 'user_002',
    });
    seedCustomLeads([lead]);
    renderAtRoute('/leads/lead_foreign_ui/edit', 'user_001', false);

    expect(await screen.findByRole('heading', { name: 'Zugriff verweigert' })).toBeInTheDocument();
  });

  it('shows edit action only for permitted users on detail page', async () => {
    const ownLead = createTestLead({
      id: 'lead_own_detail',
      assignedSalesUserId: 'user_001',
      createdByUserId: 'user_001',
    });
    seedCustomLeads([ownLead]);
    renderAtRoute('/leads/lead_own_detail', 'user_001', false);

    expect(await screen.findByRole('link', { name: 'Bearbeiten' })).toBeInTheDocument();
  });

  it('hides edit action for foreign leads on detail page', async () => {
    const foreignLead = createTestLead({
      id: 'lead_foreign_detail',
      assignedSalesUserId: 'user_002',
      createdByUserId: 'user_002',
    });
    seedCustomLeads([foreignLead]);
    renderAtRoute('/leads/lead_foreign_detail', 'user_001', false);

    await screen.findByRole('heading', { name: 'Repository Test' });
    expect(screen.queryByRole('link', { name: 'Bearbeiten' })).not.toBeInTheDocument();
  });

  it('opens unsaved changes dialog on cancel', async () => {
    const user = userEvent.setup();
    const lead = createTestLead({
      id: 'lead_cancel_ui',
      assignedSalesUserId: 'user_001',
      createdByUserId: 'user_001',
    });
    seedCustomLeads([lead]);
    renderAtRoute('/leads/lead_cancel_ui/edit', 'user_001', false);

    await user.type(await screen.findByLabelText('Firmenname'), 'Geändert');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
  });

  it('restores edit drafts for the same lead', async () => {
    const lead = createTestLead({
      id: 'lead_edit_draft',
      companyName: 'Original GmbH',
      assignedSalesUserId: 'user_001',
      createdByUserId: 'user_001',
      updatedAt: '2026-07-30T08:00:00.000Z',
    });
    seedCustomLeads([lead]);
    writeStorageItem(STORAGE_KEYS.leadEditDrafts, {
      lead_edit_draft: {
        input: leadToEditInput({ ...lead, companyName: 'Draft GmbH' }),
        savedAt: '2026-07-30T12:00:00.000Z',
      },
    });
    renderAtRoute('/leads/lead_edit_draft/edit', 'user_001', false);

    expect(await screen.findByDisplayValue('Draft GmbH')).toBeInTheDocument();
    expect(await screen.findByText('Gespeicherte Änderungen wurden wiederhergestellt')).toBeInTheDocument();
  });

  it('shows not found state for unknown lead id', async () => {
    renderAtRoute('/leads/lead_unknown/edit');

    expect(await screen.findByRole('heading', { name: 'Kunde nicht gefunden' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zur Kundenliste' })).toBeInTheDocument();
  });

  it('validates changes before saving', async () => {
    const user = userEvent.setup();
    const lead = createTestLead({
      id: 'lead_validate_ui',
      assignedSalesUserId: 'user_001',
      createdByUserId: 'user_001',
    });
    seedCustomLeads([lead]);
    renderAtRoute('/leads/lead_validate_ui/edit', 'user_001', false);

    await user.clear(await screen.findByLabelText('Firmenname'));
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    expect(await screen.findByText('Bitte geben Sie einen Firmennamen ein.')).toBeInTheDocument();
  });

  it('continues editing when dialog cancel is clicked', async () => {
    const user = userEvent.setup();
    const lead = createTestLead({
      id: 'lead_continue',
      assignedSalesUserId: 'user_001',
      createdByUserId: 'user_001',
    });
    seedCustomLeads([lead]);
    renderAtRoute('/leads/lead_continue/edit', 'user_001', false);

    await user.type(await screen.findByLabelText('Notizen'), 'Noch bearbeiten');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Weiter bearbeiten' }));

    expect(screen.getByLabelText('Notizen')).toHaveValue('Noch bearbeiten');
  });
});
