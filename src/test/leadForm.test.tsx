import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CREATE_LEAD_INPUT } from '../domain/lead/defaults';
import { LeadForm } from '../features/lead/LeadForm';

describe('LeadForm', () => {
  it('renders labeled inputs', () => {
    render(
      <LeadForm
        mode="create"
        values={DEFAULT_CREATE_LEAD_INPUT}
        errors={{}}
        cardMixSummary="Summe: 0 % — vollständig"
        isCardMixValid
        isSubmitting={false}
        showDiscard={false}
        onChange={() => undefined}
        onSubmit={() => undefined}
        onCancel={() => undefined}
        onDiscard={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Firmenname')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Lead-Erfassung' })).toBeInTheDocument();
  });
});
