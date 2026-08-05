import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import { CostsStep } from '../v2/advice/steps/CostsStep';

vi.mock('../config/billingOcrFeature', () => ({
  isAdviceBillingOcrImportEnabled: vi.fn(),
}));

import { isAdviceBillingOcrImportEnabled } from '../config/billingOcrFeature';

const billingImportService = {
  getSalesViewForSession: vi.fn(async () => null),
} as never;

const baseProps = {
  busy: false,
  userContext: { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura' },
  billingImportService,
  onSelectMode: vi.fn(),
  onPatchCosts: vi.fn(),
  onPatchCurrentProvider: vi.fn(),
  onBaselineConfirmed: vi.fn(),
  showToast: vi.fn(),
};

describe('CostsStep OCR-Sichtbarkeit', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('blendet Abrechnung einlesen ohne Feature-Flag aus', () => {
    vi.mocked(isAdviceBillingOcrImportEnabled).mockReturnValue(false);
    const session = createBestPayComparisonSession({ createdByUserId: 'user_001' });
    render(<CostsStep {...baseProps} session={session} costCaptureMode={null} />);
    expect(screen.queryByRole('button', { name: 'Abrechnung einlesen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Kosten manuell eingeben' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Noch keine Payment-Lösung / aktuelle Kosten 0 €' }),
    ).toBeTruthy();
  });

  it('zeigt Abrechnung einlesen mit Feature-Flag', () => {
    vi.mocked(isAdviceBillingOcrImportEnabled).mockReturnValue(true);
    const session = createBestPayComparisonSession({ createdByUserId: 'user_001' });
    render(<CostsStep {...baseProps} session={session} costCaptureMode={null} />);
    expect(screen.getByRole('button', { name: 'Abrechnung einlesen' })).toBeTruthy();
  });
});
