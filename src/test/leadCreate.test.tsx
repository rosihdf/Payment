import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { DEFAULT_CREATE_LEAD_INPUT } from '../domain/lead/defaults';
import type { Lead } from '../domain/lead/lead';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { createValidLeadInput } from './helpers/leadTestHelpers';

function renderAtRoute(initialRoute: string, resetData = true, currentUserId = 'user_001') {
  if (resetData) {
    clearDemoDataForTests();
    resetDemoDataForTests();
  }

  writeStorageItem(STORAGE_KEYS.currentUserId, currentUserId);

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

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Firmenname'), 'Neuer Payment Shop');
  await user.type(screen.getByLabelText('Vorname'), 'Jonas');
  await user.type(screen.getByLabelText('Nachname'), 'Lehmann');
  await user.type(screen.getByLabelText('Telefonnummer'), '+49 221 55554444');
}

describe('Lead creation UI', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('shows validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    renderAtRoute('/leads/new');

    await user.click(await screen.findByRole('button', { name: 'Lead speichern' }));

    expect(await screen.findByText('Bitte geben Sie einen Firmennamen ein.')).toBeInTheDocument();
    expect(screen.getByText('Bitte geben Sie einen Vornamen ein.')).toBeInTheDocument();
    expect(screen.getByText('Bitte geben Sie einen Nachnamen ein.')).toBeInTheDocument();
    expect(screen.getByText('Bitte geben Sie eine Telefonnummer ein.')).toBeInTheDocument();
  });

  it('shows card mix validation error on submit', async () => {
    const user = userEvent.setup();
    renderAtRoute('/leads/new');

    await fillRequiredFields(user);
    await user.clear(screen.getByLabelText('Girocard in Prozent'));
    await user.type(screen.getByLabelText('Girocard in Prozent'), '50');
    await user.click(screen.getByRole('button', { name: 'Lead speichern' }));

    expect(
      await screen.findByText('Die Kartenanteile müssen zusammen 100 % ergeben.'),
    ).toBeInTheDocument();
  });

  it('creates a lead and navigates to the detail view', async () => {
    const user = userEvent.setup();
    renderAtRoute('/leads/new');

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('E-Mail'), 'jonas@payment-shop.de');
    await user.click(screen.getByRole('button', { name: 'Lead speichern' }));

    await waitFor(() => {
      expect(getStoredLeads().some((lead) => lead.companyName === 'Neuer Payment Shop')).toBe(true);
    });

    const createdLead = getStoredLeads().find((lead) => lead.companyName === 'Neuer Payment Shop');
    expect(createdLead).toBeDefined();

    renderAtRoute(`/leads/${createdLead!.id}`, false);

    expect(await screen.findByRole('heading', { name: 'Neuer Payment Shop' })).toBeInTheDocument();
    expect(screen.getByText('Jonas Lehmann')).toBeInTheDocument();
    expect(screen.getByText('jonas@payment-shop.de')).toBeInTheDocument();
  });

  it('adds the created lead to the leads list', async () => {
    const user = userEvent.setup();
    renderAtRoute('/leads/new');

    await fillRequiredFields(user);
    await user.clear(screen.getByLabelText('Firmenname'));
    await user.type(screen.getByLabelText('Firmenname'), 'Liste Test GmbH');
    await user.click(screen.getByRole('button', { name: 'Lead speichern' }));

    await waitFor(() => {
      expect(getStoredLeads().some((lead) => lead.companyName === 'Liste Test GmbH')).toBe(true);
    });

    renderAtRoute('/leads', false);

    expect(await screen.findByText('Liste Test GmbH')).toBeInTheDocument();
  });

  it('opens a confirmation dialog when canceling with changes', async () => {
    const user = userEvent.setup();
    renderAtRoute('/leads/new');

    await user.type(await screen.findByLabelText('Firmenname'), 'Abbruch Test');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Bearbeitung abbrechen?')).toBeInTheDocument();
  });

  it('restores a saved draft after reload', async () => {
    writeStorageItem(STORAGE_KEYS.leadDrafts, {
      user_001: createValidLeadInput({
        companyName: 'Draft Restore GmbH',
        notes: 'Zwischengespeichert',
      }),
    });

    renderAtRoute('/leads/new', false);

    expect(await screen.findByDisplayValue('Draft Restore GmbH')).toBeInTheDocument();
    expect(await screen.findByText('Gespeicherter Entwurf wiederhergestellt')).toBeInTheDocument();
  });

  it('discards inputs after confirmation', async () => {
    const user = userEvent.setup();
    renderAtRoute('/leads/new');

    await user.type(await screen.findByLabelText('Firmenname'), 'Verwerfen Test');
    await user.click(screen.getByRole('button', { name: 'Eingaben verwerfen' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Eingaben verwerfen' }));

    expect(await screen.findByText('Eingaben wurden verworfen')).toBeInTheDocument();
    expect(screen.getByLabelText('Firmenname')).toHaveValue('');
  });

  it('disables save button while submitting', async () => {
    const user = userEvent.setup();
    renderAtRoute('/leads/new');

    await fillRequiredFields(user);

    const saveButton = screen.getByRole('button', { name: 'Lead speichern' });
    await user.click(saveButton);

    await waitFor(() => {
      expect(getStoredLeads().some((lead) => lead.companyName === 'Neuer Payment Shop')).toBe(true);
    });
  });

  it('does not show draft restore message for empty drafts', async () => {
    writeStorageItem(STORAGE_KEYS.leadDrafts, {
      user_001: DEFAULT_CREATE_LEAD_INPUT,
    });

    renderAtRoute('/leads/new', false);

    await screen.findByLabelText('Firmenname');
    expect(screen.queryByText('Gespeicherter Entwurf wiederhergestellt')).not.toBeInTheDocument();
  });
});

describe('Lead creation draft debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists draft changes after debounce', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAtRoute('/leads/new');

    await user.type(await screen.findByLabelText('Firmenname'), 'Debounce GmbH');
    await vi.advanceTimersByTimeAsync(450);

    const drafts = JSON.parse(localStorage.getItem(STORAGE_KEYS.leadDrafts) ?? '{}') as Record<
      string,
      { companyName: string }
    >;

    expect(drafts.user_001?.companyName).toBe('Debounce GmbH');
  });
});
