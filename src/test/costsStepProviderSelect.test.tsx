import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import { CostsStep } from '../v2/advice/steps/CostsStep';

function renderCosts(onPatchCurrentProvider = vi.fn()) {
  const session = createBestPayComparisonSession('user_001');
  session.wizard.costCaptureMode = 'manual';
  render(
    <CostsStep
      session={session}
      busy={false}
      costCaptureMode="manual"
      userContext={{ userId: 'user_001', role: 'field_service', displayName: 'Laura' }}
      billingImportService={{} as never}
      onSelectMode={vi.fn()}
      onPatchCosts={vi.fn()}
      onPatchCurrentProvider={onPatchCurrentProvider}
      onBaselineConfirmed={vi.fn()}
      showToast={vi.fn()}
    />,
  );
  return { onPatchCurrentProvider };
}

describe('CostsStep Anbieter-Auswahl', () => {
  afterEach(() => {
    cleanup();
  });

  it('bietet Kataloganbieter und Sonderoptionen', () => {
    renderCosts();
    const select = screen.getByRole('combobox', { name: 'Aktueller Anbieter' });
    fireEvent.click(select);
    expect(screen.getByRole('option', { name: 'Bitte wählen' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Noch kein Anbieter' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'SumUp' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Anderer Anbieter' })).toBeTruthy();
  });

  it('zeigt Freitext nur bei Anderer Anbieter', () => {
    const { onPatchCurrentProvider } = renderCosts();
    const select = screen.getByRole('combobox', { name: 'Aktueller Anbieter' });
    fireEvent.click(select);
    fireEvent.click(screen.getByRole('option', { name: 'Anderer Anbieter' }));
    expect(screen.getByLabelText('Anbietername')).toBeTruthy();
    expect(onPatchCurrentProvider).toHaveBeenCalledWith({
      currentProviderCode: 'other',
      currentProviderOther: '',
    });

    fireEvent.click(screen.getByRole('combobox', { name: 'Aktueller Anbieter' }));
    fireEvent.click(screen.getByRole('option', { name: 'Noch kein Anbieter' }));
    expect(screen.queryByLabelText('Anbietername')).toBeNull();
    expect(onPatchCurrentProvider).toHaveBeenCalledWith({
      currentProviderCode: 'none',
      currentProviderOther: '',
    });
  });
});
