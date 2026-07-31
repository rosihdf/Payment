import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { DEFAULT_CURRENT_PAYMENT_CONDITIONS } from '../domain/calculator/comparisonDefaults';
import { calculatePaymentComparison } from '../services/paymentComparisonService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { formatCentsToCurrency } from '../utils/currency';

function renderAtRoute(initialRoute: string, currentUserId = 'user_001') {
  clearDemoDataForTests();
  resetDemoDataForTests();
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

describe('Calculator page', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('loads the calculator page', async () => {
    renderAtRoute('/calculator');
    expect(await screen.findByRole('heading', { name: 'Rechner' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'BestPay' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vertriebs-Wizard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vertriebsprozess' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Neue Berechnung' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gespeicherte Berechnungen' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zum Vertriebsprozess' })).toBeInTheDocument();
    expect(
      screen.getByText('Bisherige Payment-Kosten manuell mit einem aktiven BestPay-Tarif vergleichen.'),
    ).toBeInTheDocument();
  });

  it('shows active tariffs in the select', async () => {
    renderAtRoute('/calculator');
    const select = await screen.findByLabelText('BestPay-Tarif');
    expect(select).toBeInTheDocument();
    expect(within(select as HTMLElement).getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('shows current contract input fields', async () => {
    renderAtRoute('/calculator');
    expect(await screen.findByLabelText('Anzahl angemieteter Terminals')).toBeInTheDocument();
    expect(screen.getByLabelText('Vertragslaufzeit in Jahren')).toBeInTheDocument();
    expect(screen.getByLabelText('Mietkosten je Terminal monatlich')).toBeInTheDocument();
  });

  it('updates result when terminal count changes', async () => {
    const user = userEvent.setup();
    renderAtRoute('/calculator');

    await screen.findByRole('heading', { name: 'Ergebnisübersicht' });

    const terminalField = screen.getByLabelText('Anzahl angemieteter Terminals');
    await user.clear(terminalField);
    await user.type(terminalField, '2');

    await waitFor(() => {
      expect(screen.getByText('Bisherige Kosten')).toBeInTheDocument();
    });
  });

  it('updates result when tariff changes', async () => {
    const user = userEvent.setup();
    renderAtRoute('/calculator');

    const select = await screen.findByLabelText('BestPay-Tarif');
    const options = within(select as HTMLElement).getAllByRole('option');
    if (options.length < 2) {
      return;
    }

    await user.selectOptions(select, options[1]!);
    expect(await screen.findByRole('heading', { name: 'Ergebnisübersicht' })).toBeInTheDocument();
  });

  it('shows savings overview for default excel current values', async () => {
    renderAtRoute('/calculator');
    expect(await screen.findByRole('heading', { name: 'Ergebnisübersicht' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Monatliche (Ersparnis|Mehrkosten)/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Jährliche (Ersparnis|Mehrkosten)/)).toBeInTheDocument();
    expect(screen.getByText(/(Ersparnis|Mehrkosten) Vertragslaufzeit/)).toBeInTheDocument();
  });

  it('shows cost breakdown for both sides', async () => {
    renderAtRoute('/calculator');
    expect(await screen.findByText('Bisherige Kosten')).toBeInTheDocument();
    expect(screen.getByText('BestPay-Kosten')).toBeInTheDocument();
    expect(screen.getAllByText('Gesamtkosten monatlich').length).toBeGreaterThan(0);
  });

  it('resets inputs to defaults', async () => {
    const user = userEvent.setup();
    renderAtRoute('/calculator');

    const terminalField = await screen.findByLabelText('Anzahl angemieteter Terminals');
    await user.clear(terminalField);
    await user.type(terminalField, '4');
    await user.click(screen.getByRole('button', { name: 'Eingaben zurücksetzen' }));

    expect(terminalField).toHaveValue('1');
  });

  it('shows mehrkosten label for negative savings', async () => {
    renderAtRoute('/calculator');

    const terminalField = await screen.findByLabelText('Anzahl angemieteter Terminals');
    fireEvent.change(terminalField, { target: { value: '20' } });

    await waitFor(() => {
      const headings = screen.queryAllByRole('heading', { level: 3 });
      const labels = headings.map((heading) => heading.textContent);
      expect(
        labels.some((label) => label?.includes('Mehrkosten') || label?.includes('Ersparnis')),
      ).toBe(true);
    });
  });

  it('shows empty state when no active tariffs exist', async () => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.tariffs, []);
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_004');

    const memoryRouter = createMemoryRouter(appRoutes, {
      initialEntries: ['/calculator'],
    });

    render(
      <AppProviders>
        <RouterProvider router={memoryRouter} />
      </AppProviders>,
    );

    expect(await screen.findByText('Keine aktiven Tarife verfügbar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zur Tarifverwaltung' })).toHaveAttribute(
      'href',
      '/admin/tariffs',
    );
  });
});

describe('Calculator reference formatting', () => {
  it('formats the excel current total in the UI model', () => {
    const result = calculatePaymentComparison(DEFAULT_CURRENT_PAYMENT_CONDITIONS, {
      tariffId: 'excel-reference',
      tariffName: 'Excel Referenz',
      productCode: 'EXCEL-REFERENCE',
      monthlyAccountBaseFeeCents: 0,
      monthlyTerminalRentalCents: 995,
      monthlyServiceFeePerTerminalCents: 0,
      transactionFeeTenthsOfCent: 59,
      girocardClearingFeeTenthsOfCent: 19,
      girocardRateTenthsOfBasisPoint: 400,
      creditCardRateTenthsOfBasisPoint: 790,
      debitCardRateTenthsOfBasisPoint: 790,
    });

    expect(formatCentsToCurrency(result.current.totalMonthlyCostsCents)).toBe('174,35\u00a0€');
    expect(formatCentsToCurrency(result.monthlySavingsCents)).toBe('24,85\u00a0€');
  });
});
