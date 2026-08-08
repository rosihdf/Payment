import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import { NeedStep } from '../v2/advice/steps/NeedStep';

describe('NeedStep Katalog-UX', () => {
  afterEach(() => {
    cleanup();
  });

  it('bietet „Noch offen“ und individuelle Laufzeit statt globalem 24/36-Katalog', () => {
    const session = createBestPayComparisonSession('user_001');
    render(<NeedStep session={session} busy={false} onPatch={vi.fn()} />);
    const term = screen.getByRole('combobox', { name: 'Gewünschte Vertragslaufzeit' });
    fireEvent.click(term);
    const options = screen.getAllByRole('option').map((option) => option.getAttribute('data-value'));
    expect(options).toContain('');
    expect(options).toContain('36');
    expect(options).not.toContain('24');
    expect(options).not.toContain('48');
  });

  it('hält veraltete 48 Monate lesbar (nicht auf 36 mappen)', () => {
    const session = createBestPayComparisonSession('user_001');
    session.manualInput.preferredTermMonths = 48;
    render(<NeedStep session={session} busy={false} onPatch={vi.fn()} />);
    const term = screen.getByRole('combobox', { name: 'Gewünschte Vertragslaufzeit' });
    expect(term).toHaveAttribute('data-value', '48');
    expect(within(term).getByText('48 Monate (individuell)')).toBeTruthy();
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
