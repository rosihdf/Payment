import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AccessDenied } from '../components/feedback/AccessDenied';

function renderAccessDenied(props?: { title?: string; description?: string }) {
  return render(
    <MemoryRouter>
      <AccessDenied {...props} />
    </MemoryRouter>,
  );
}

describe('AccessDenied', () => {
  it('renders default title, description and home link', () => {
    renderAccessDenied();

    expect(screen.getByRole('heading', { name: 'Zugriff verweigert' })).toBeInTheDocument();
    expect(screen.getByText(/Sie haben keine Berechtigung/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zum Arbeitsplatz' })).toHaveAttribute('href', '/sales');
  });

  it('renders custom messages', () => {
    renderAccessDenied({
      title: 'Admin erforderlich',
      description: 'Nur Administratoren dürfen diese Seite sehen.',
    });

    expect(screen.getByRole('heading', { name: 'Admin erforderlich' })).toBeInTheDocument();
    expect(screen.getByText('Nur Administratoren dürfen diese Seite sehen.')).toBeInTheDocument();
  });
});
