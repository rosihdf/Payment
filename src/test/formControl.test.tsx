import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormControl } from '../components/common/FormControl';
import styles from '../components/common/FormControl.module.css';

const FEATURE_PAGES = [
  'src/v2/admin/AdminUsersPage.tsx',
  'src/v2/crm/LeadForm.tsx',
  'src/features/tariff/TariffForm.tsx',
  'src/features/product/ProductForm.tsx',
  'src/features/offer/OfferCustomerSection.tsx',
  'src/features/offer/OffersPage.tsx',
  'src/features/contract/ContractsPage.tsx',
  'src/components/navigation/RoleSwitcher.tsx',
  'src/features/auth/LoginPage.tsx',
];

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('FormControl', () => {
  it('nutzt eine gemeinsame CSS-Datei für Input und Select', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/components/common/FormControl.module.css'),
      'utf8',
    );
    expect(css).toContain('.control');
    expect(css).toContain('.selectTrigger');
    expect(css).toContain('.selectChevron');
    expect(css).not.toMatch(/appearance:\s*none/);
  });

  it('rendert Text-Input mit kanonischer Control-Klasse', () => {
    render(
      <FormControl
        id="company"
        type="text"
        label="Firma"
        value="AMRtech"
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText('Firma')).toHaveClass(styles.control!);
  });

  it('rendert kein natives Select-Element', () => {
    render(
      <FormControl id="scope" type="select" label="Sicht" value="mine" onChange={() => undefined}>
        <option value="mine">Meine Fälle</option>
        <option value="team">Team</option>
      </FormControl>,
    );
    expect(screen.queryByRole('combobox')).toBeInTheDocument();
    expect(document.querySelector('select')).toBeNull();
  });

  it('select rendert eigenen Dropdown-Pfeil', () => {
    render(
      <FormControl id="scope-arrow" type="select" label="Sicht" value="mine" onChange={() => undefined}>
        <option value="mine">Meine Fälle</option>
      </FormControl>,
    );
    expect(document.querySelector(`.${styles.selectChevron} svg`)).toBeTruthy();
  });

  it('unterstützt Fehler- und Disabled-Zustand beim Select', () => {
    const { rerender } = render(
      <FormControl id="state-select" type="select" label="Status" value="a" error onChange={() => undefined}>
        <option value="a">A</option>
      </FormControl>,
    );
    expect(screen.getByRole('combobox').className).toContain(styles.controlError);

    rerender(
      <FormControl id="state-select" type="select" label="Status" value="a" disabled onChange={() => undefined}>
        <option value="a">A</option>
      </FormControl>,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('Select öffnet und wählt Option per Klick', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FormControl id="filter-scope" type="select" label="Sicht" value="mine" onChange={onChange}>
        <option value="mine">Meine Fälle</option>
        <option value="team">Team</option>
      </FormControl>,
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Team' }));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0]?.[0]?.target?.value).toBe('team');
  });

  it.each(FEATURE_PAGES)('keine rohen Selects oder alten Komponenten in %s', (pagePath) => {
    const source = readSource(pagePath);
    expect(source).not.toMatch(/<select[\s/>]/);
    expect(source).not.toMatch(/SelectControl|SelectField|SearchField|inputs\.module/);
    expect(source).toMatch(/FormControl|FormField/);
  });

  it('Arbeitsplatz-Filter nutzt FormField für Suche und Ansicht', () => {
    const source = readSource('src/v2/workspace/WorkspacePage.tsx');
    expect(source).toContain('type="search"');
    expect(source).toContain('type="select"');
    expect(source).toContain('label="Ansicht"');
  });
});
