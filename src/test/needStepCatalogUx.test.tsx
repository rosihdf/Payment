import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import { NeedStep } from '../v2/advice/steps/NeedStep';

describe('NeedStep Katalog-UX', () => {
  afterEach(() => {
    cleanup();
  });

  it('bietet nur Katalog-Laufzeiten 24 und 36 Monate an', () => {
    const session = createBestPayComparisonSession('user_001');
    render(<NeedStep session={session} busy={false} onPatch={vi.fn()} />);
    const term = screen.getByRole('combobox', { name: 'Maximale Vertragslaufzeit' });
    fireEvent.click(term);
    const options = screen.getAllByRole('option').map((option) => option.getAttribute('data-value'));
    expect(options).toEqual(['24', '36']);
    expect(options).not.toContain('48');
    expect(options).not.toContain('60');
  });

  it('mapped veraltete 48 Monate auf 36 in der Anzeige', () => {
    const session = createBestPayComparisonSession('user_001');
    session.manualInput.preferredTermMonths = 48;
    render(<NeedStep session={session} busy={false} onPatch={vi.fn()} />);
    const term = screen.getByRole('combobox', { name: 'Maximale Vertragslaufzeit' });
    expect(term).toHaveAttribute('data-value', '36');
    expect(within(term).getByText('36 Monate')).toBeTruthy();
  });

  it('erklärt Einsatzarten und aktiviert nur mobiles Terminal', () => {
    const session = createBestPayComparisonSession('user_001');
    const onPatch = vi.fn();
    render(<NeedStep session={session} busy={false} onPatch={onPatch} />);

    expect(screen.getByText('Mobiles Kartenterminal')).toBeTruthy();
    expect(screen.getByText(/Festes Terminal an der Kasse/)).toBeTruthy();

    const mobile = screen.getByRole('checkbox', { name: /Mobiles Kartenterminal/i });
    const stationary = screen.getByRole('checkbox', { name: /Festes Terminal an der Kasse/i });
    expect(mobile).not.toBeDisabled();
    expect(stationary).toBeDisabled();

    fireEvent.click(mobile);
    expect(onPatch).toHaveBeenCalled();
  });

  it('hält die Branchenauswahl im value', () => {
    const session = createBestPayComparisonSession('user_001');
    session.manualInput.industry = 'Gastronomie';
    render(<NeedStep session={session} busy={false} onPatch={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Branche' })).toHaveAttribute(
      'data-value',
      'Gastronomie',
    );
  });
});
