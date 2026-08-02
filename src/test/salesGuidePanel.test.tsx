import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SalesGuidePanel } from '../components/sales/SalesGuidePanel';
import { NO_SIGNATURE_REQUIRED_MESSAGE } from '../domain/sales/salesGuide';

describe('SalesGuidePanel', () => {
  it('zeigt Phaseninhalt und Verkaufstipps', () => {
    render(<SalesGuidePanel context="offer" tipSeed="test-session" />);

    expect(screen.getByText(/Phase 5/)).toBeInTheDocument();
    expect(screen.getByText('Angebot erstellen')).toBeInTheDocument();
    expect(screen.getByText(NO_SIGNATURE_REQUIRED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText('Verkaufstipps')).toBeChecked();
    expect(screen.getByText(/^Tipp:/)).toBeInTheDocument();
  });

  it('blendet Verkaufstipps aus, wenn deaktiviert', async () => {
    const user = await import('@testing-library/user-event').then((module) => module.default.setup());
    render(<SalesGuidePanel context="prospect" tipSeed="test-session" compact />);

    await user.click(screen.getByLabelText('Verkaufstipps'));
    expect(screen.queryByText(/^Tipp:/)).not.toBeInTheDocument();
  });
});
