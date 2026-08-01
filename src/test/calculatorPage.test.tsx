import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { DEFAULT_CURRENT_PAYMENT_CONDITIONS } from '../domain/calculator/comparisonDefaults';
import { calculatePaymentComparison } from '../services/paymentComparisonService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { formatCentsToCurrency } from '../utils/currency';
import { ADVICE_PATH } from '../utils/routes';

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

  it('leitet parallelen Schnellrechner auf Beratung um', async () => {
    const router = renderAtRoute('/advice/quick');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ADVICE_PATH);
    });
    expect(await screen.findByRole('heading', { name: 'Beratung', level: 1 })).toBeInTheDocument();
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
