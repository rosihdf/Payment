import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import type { Tariff } from '../domain/tariff/tariff';
import { normalizeTariffs } from '../domain/tariff/normalizeTariff';
import { DEFAULT_CREATE_TARIFF_INPUT } from '../domain/tariff/defaults';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import * as storageModule from '../utils/storage';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function getStoredTariffs(): Tariff[] {
  const raw = localStorage.getItem(STORAGE_KEYS.tariffs);
  return raw ? normalizeTariffs(JSON.parse(raw) as unknown[]) : [];
}

function renderAtRoute(initialRoute: string, resetData = true, currentUserId = 'user_004') {
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

async function fillRequiredTariffFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Tarifname'), 'Neuer Demo Tarif');
  await user.type(screen.getByLabelText('Produktcode (intern)'), 'BP-NEW-001');
  await user.click(screen.getByRole('button', { name: 'Stationär' }));
}

describe('Tariff form UI', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('validates required fields on create', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs/new');

    await user.click(await screen.findByRole('button', { name: 'Tarif speichern' }));

    expect(await screen.findByText('Bitte geben Sie einen Tarifnamen ein.')).toBeInTheDocument();
    expect(screen.getByText('Bitte geben Sie einen Produktcode ein.')).toBeInTheDocument();
    expect(
      screen.getByText('Bitte wählen Sie mindestens eine Einsatzart.'),
    ).toBeInTheDocument();
  });

  it('prefills existing tariff on edit', async () => {
    renderAtRoute('/admin/tariffs/tariff_bestpay_a920_classic/edit');

    expect(await screen.findByLabelText('Tarifname')).toHaveValue('BestPay Mobile A920 Classic');
    expect(screen.getByLabelText('Produktcode (intern)')).toHaveValue('BP-A920-CLASSIC');
    expect(screen.getByRole('button', { name: 'Mobil' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('creates tariff and navigates to overview', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs/new');

    await fillRequiredTariffFields(user);
    await user.click(screen.getByRole('button', { name: 'Tarif speichern' }));

    await waitFor(() => {
      expect(getStoredTariffs().some((tariff) => tariff.name === 'Neuer Demo Tarif')).toBe(true);
    });

    renderAtRoute('/admin/tariffs', false);
    expect(await screen.findByText('Neuer Demo Tarif')).toBeInTheDocument();
  });

  it('prevents duplicate product code', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs/new');

    await user.type(await screen.findByLabelText('Tarifname'), 'Duplikat Tarif');
    await user.type(screen.getByLabelText('Produktcode (intern)'), 'bp-a920-classic');
    await user.click(screen.getByRole('button', { name: 'Mobil' }));
    await user.click(screen.getByRole('button', { name: 'Tarif speichern' }));

    expect(
      await screen.findByText('Dieser Produktcode wird bereits verwendet.'),
    ).toBeInTheDocument();
  });

  it('updates tariff and navigates to overview', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs/tariff_bestpay_a920_classic/edit');

    const nameField = await screen.findByLabelText('Tarifname');
    await user.clear(nameField);
    await user.type(nameField, 'BestPay Mobile A920 Classic Plus');
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(
        getStoredTariffs().some((tariff) => tariff.name === 'BestPay Mobile A920 Classic Plus'),
      ).toBe(true);
    });

    renderAtRoute('/admin/tariffs', false);
    expect(await screen.findByText('BestPay Mobile A920 Classic Plus')).toBeInTheDocument();
  });

  it('shows cancel dialog when form is dirty', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs/new');

    await user.type(await screen.findByLabelText('Tarifname'), 'Abbruch Test');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
  });

  it('navigates back on cancel without changes', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs/new');

    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }));

    expect(navigateMock).toHaveBeenCalledWith('/admin/tariffs', { replace: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps form data on storage error', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs/new');

    await fillRequiredTariffFields(user);

    const originalWrite = storageModule.writeStorageItem.bind(storageModule);
    const writeSpy = vi.spyOn(storageModule, 'writeStorageItem').mockImplementation((key, value) => {
      if (key === STORAGE_KEYS.tariffs) {
        throw new Error('quota exceeded');
      }

      return originalWrite(key, value);
    });

    try {
      await user.click(screen.getByRole('button', { name: 'Tarif speichern' }));

      expect(await screen.findByLabelText('Tarifname')).toHaveValue('Neuer Demo Tarif');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Tarif speichern' })).toBeEnabled();
      });
      expect(navigateMock).not.toHaveBeenCalled();
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('prevents double submit while saving', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs/new');

    await fillRequiredTariffFields(user);
    const submitButton = screen.getByRole('button', { name: 'Tarif speichern' });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
  });
});

describe('Tariff form mapping', () => {
  it('detects unchanged default input', async () => {
    renderAtRoute('/admin/tariffs/new');
    expect(await screen.findByLabelText('Anbietername')).toHaveValue(DEFAULT_CREATE_TARIFF_INPUT.providerName);
    expect(screen.getByLabelText('Tarifname')).toHaveValue('');
  });
});

describe('Percent values in form', () => {
  it('accepts percent input with German comma on create', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs/new');

    await fillRequiredTariffFields(user);
    const percentField = document.getElementById('cardRates-girocard-percentage') as HTMLInputElement;
    fireEvent.change(percentField, { target: { value: '0,25' } });
    fireEvent.blur(percentField);
    await user.click(screen.getByRole('button', { name: 'Tarif speichern' }));

    await waitFor(() => {
      const created = getStoredTariffs().find((tariff) => tariff.name === 'Neuer Demo Tarif');
      expect(created?.cardRates.girocard.percentageTenthsOfBasisPoint).toBe(250);
    });
  });
});
