import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import { NeedStep } from '../v2/advice/steps/NeedStep';

describe('NeedStep Katalog-UX', () => {
  afterEach(() => {
    cleanup();
  });

  it('bietet Katalog-Laufzeiten 24 und 36 sowie „Noch offen“ an', () => {
    const session = createBestPayComparisonSession('user_001');
    render(<NeedStep session={session} busy={false} onPatch={vi.fn()} />);
    const term = screen.getByRole('combobox', { name: 'Gewünschte Vertragslaufzeit' });
    fireEvent.click(term);
    const options = screen.getAllByRole('option').map((option) => option.getAttribute('data-value'));
    expect(options).toEqual(['', '24', '36']);
    expect(options).not.toContain('48');
    expect(options).not.toContain('60');
  });

  it('mapped veraltete 48 Monate auf 36 in der Anzeige', () => {
    const session = createBestPayComparisonSession('user_001');
    session.manualInput.preferredTermMonths = 48;
    render(<NeedStep session={session} busy={false} onPatch={vi.fn()} />);
    const term = screen.getByRole('combobox', { name: 'Gewünschte Vertragslaufzeit' });
    expect(term).toHaveAttribute('data-value', '36');
    expect(within(term).getByText('36 Monate')).toBeTruthy();
  });

  it('setzt „Noch offen“ auf preferredTermMonths null', () => {
    const session = createBestPayComparisonSession('user_001');
    const onPatch = vi.fn();
    render(<NeedStep session={session} busy={false} onPatch={onPatch} />);
    const term = screen.getByRole('combobox', { name: 'Gewünschte Vertragslaufzeit' });
    fireEvent.click(term);
    fireEvent.click(
      screen.getByRole('option', { name: 'Noch offen – beste passende Option empfehlen' }),
    );
    expect(onPatch).toHaveBeenCalledWith({ preferredTermMonths: null });
  });

  it('erklärt Einsatzarten und aktiviert stationär sowie mobiles Terminal', () => {
    const session = createBestPayComparisonSession('user_001');
    const onPatch = vi.fn();
    render(<NeedStep session={session} busy={false} onPatch={onPatch} />);

    expect(screen.getByText('Unterwegs beim Kunden')).toBeTruthy();
    expect(screen.getByText('Im Geschäft oder am festen Standort')).toBeTruthy();
    expect(screen.getByText('Smartphone als Kartenterminal')).toBeTruthy();
    expect(screen.getByText('Zahlungen im Onlineshop')).toBeTruthy();
    expect(screen.getByText(/Mobiles Kartenterminal/)).toBeTruthy();
    expect(
      screen.getAllByText(/noch nicht im produktiven Katalog verfügbar/i).length,
    ).toBeGreaterThan(0);

    const mobile = screen.getByRole('checkbox', {
      name: /Unterwegs beim Kunden/i,
    });
    const stationary = screen.getByRole('checkbox', {
      name: /Im Geschäft oder am festen Standort/i,
    });
    expect(mobile).not.toBeDisabled();
    expect(stationary).not.toBeDisabled();

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
