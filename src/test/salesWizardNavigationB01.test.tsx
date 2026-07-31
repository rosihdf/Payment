import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import {
  CALCULATOR_WIZARD_LEGACY_PATH,
  SALES_WIZARD_NEW_PATH,
  SALES_WIZARD_PATH,
} from '../utils/routes';
import { SIDEBAR_NAV_ITEMS } from '../utils/navigation';

function renderAtRoute(initialRoute: string) {
  clearDemoDataForTests();
  resetDemoDataForTests();
  writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');

  const memoryRouter = createMemoryRouter(appRoutes, {
    initialEntries: [initialRoute],
  });

  render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );

  return memoryRouter;
}

function navLinks(name: string) {
  return screen.getAllByRole('link', { name, hidden: true });
}

describe('B01 Beratung Navigation', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('führt Beratung als Hauptnavigation, nicht als parallelen Wizard-Eintrag', () => {
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.to === '/calculator' && item.label === 'Beratung')).toBe(
      true,
    );
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.to === SALES_WIZARD_PATH)).toBe(false);
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.label === 'Vertriebsprozess')).toBe(false);
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.label === 'Vertriebs-Wizard')).toBe(false);
  });

  it('enthält keinen Hauptmenüpunkt Neuer Lead', () => {
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.to === '/leads/new')).toBe(false);
  });

  it('öffnet die Beratung über die kanonische Wizard-Route', async () => {
    renderAtRoute(SALES_WIZARD_NEW_PATH);
    expect(await screen.findByRole('heading', { name: 'Beratung' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Prozessschritte' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Interessent' })).toBeInTheDocument();
  });

  it('markiert Beratung bei /sales/wizard als aktiv und Arbeitsplatz nicht', async () => {
    renderAtRoute(SALES_WIZARD_NEW_PATH);
    await screen.findByRole('heading', { name: 'Beratung' });

    expect(navLinks('Beratung').every((link) => link.getAttribute('aria-current') === 'page')).toBe(
      true,
    );
    expect(navLinks('Arbeitsplatz').some((link) => link.getAttribute('aria-current') === 'page')).toBe(
      false,
    );
  });

  it('leitet die Legacy-Route /calculator/wizard auf /sales/wizard um', async () => {
    const router = renderAtRoute(`${CALCULATOR_WIZARD_LEGACY_PATH}?new=1`);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SALES_WIZARD_PATH);
    });
    expect(router.state.location.search).toBe('?new=1');
    expect(await screen.findByRole('heading', { name: 'Beratung' })).toBeInTheDocument();
    expect(navLinks('Beratung').every((link) => link.getAttribute('aria-current') === 'page')).toBe(
      true,
    );
  });

  it('zeigt im Beratungshub einen einzigen Beratungseinstieg', async () => {
    renderAtRoute('/calculator');
    await screen.findByRole('heading', { name: 'Beratung' });
    expect(screen.getByRole('link', { name: 'Beratung starten' })).toHaveAttribute(
      'href',
      SALES_WIZARD_PATH,
    );
    expect(screen.getByRole('link', { name: 'Gespeicherte Vergleiche' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Neue Berechnung' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Zum Vertriebsprozess' })).not.toBeInTheDocument();
  });

  it('startet Beratung vom Arbeitsplatz', async () => {
    const user = userEvent.setup();
    const router = renderAtRoute('/sales');
    const link = await screen.findByRole('link', { name: 'Beratung starten' });
    expect(link).toHaveAttribute('href', SALES_WIZARD_NEW_PATH);
    await user.click(link);
    expect(router.state.location.pathname).toBe(SALES_WIZARD_PATH);
    expect(router.state.location.search).toBe('?new=1');
  });

  it('verwendet beim Resume die kanonische Route und aktiven Navigationszustand', async () => {
    const user = userEvent.setup();
    const router = renderAtRoute(SALES_WIZARD_NEW_PATH);
    await screen.findByRole('heading', { name: 'Interessent' });

    await user.click(screen.getByRole('link', { name: 'Zum Arbeitsplatz' }));
    expect(router.state.location.pathname).toBe('/sales');
    expect(await screen.findByRole('heading', { name: 'Laufende Vorgänge' })).toBeInTheDocument();

    const resumeLink = await screen.findByRole('link', { name: /^Vorgang fortsetzen:/ });
    expect(resumeLink.getAttribute('href')).toMatch(/^\/sales\/wizard\?session=/);

    await user.click(resumeLink);
    expect(router.state.location.pathname).toBe(SALES_WIZARD_PATH);
    expect(await screen.findByRole('heading', { name: 'Beratung' })).toBeInTheDocument();

    expect(navLinks('Beratung').every((link) => link.getAttribute('aria-current') === 'page')).toBe(
      true,
    );
    expect(navLinks('Arbeitsplatz').some((link) => link.getAttribute('aria-current') === 'page')).toBe(
      false,
    );
  });

  it('lässt Kundenanlage über die Kundenübersicht zu', async () => {
    renderAtRoute('/leads');
    expect(await screen.findByRole('link', { name: 'Neuer Kunde' })).toHaveAttribute(
      'href',
      '/leads/new',
    );
  });

  it('navigiert per Schrittleiste und speichert Fortschritt', async () => {
    const user = userEvent.setup();
    renderAtRoute(SALES_WIZARD_NEW_PATH);
    await screen.findByRole('heading', { name: 'Interessent' });
    const steps = within(screen.getByRole('navigation', { name: 'Prozessschritte' }));
    await user.click(steps.getByRole('button', { name: /Aktuelle Kosten/i }));
    expect(await screen.findByRole('heading', { name: 'Aktuelle Kosten' })).toBeInTheDocument();
  });
});
