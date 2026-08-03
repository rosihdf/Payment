import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponsiveTable } from '../components/common/ResponsiveTable';

describe('ResponsiveTable', () => {
  it('rendert Desktop-Tabelle und Mobile-Karten', () => {
    render(
      <ResponsiveTable
        columns={[
          { id: 'name', header: 'Name', render: (row: { name: string }) => row.name },
          { id: 'amount', header: 'Betrag', render: (row: { amount: string }) => row.amount },
        ]}
        rows={[{ name: 'Classic Akquise', amount: '300,00 €' }]}
        rowKey={(row) => row.name}
        renderActions={() => <button type="button">Bearbeiten</button>}
      />,
    );

    expect(screen.getAllByText('Classic Akquise').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Bearbeiten' }).length).toBeGreaterThan(0);
  });
});
