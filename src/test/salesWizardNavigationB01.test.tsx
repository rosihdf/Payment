import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import {
  ADVICE_PATH,
  CALCULATOR_WIZARD_LEGACY_PATH,
  LEGACY_SALES_WIZARD_PATH,
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
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.to === ADVICE_PATH && item.label === 'Beratung')).toBe(
      true,
    );
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.to === LEGACY_SALES_WIZARD_PATH)).toBe(false);
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.label === 'Vertriebsprozess')).toBe(false);
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.label === 'Vertriebs-Wizard')).toBe(false);
  });

  it('enthält keinen Hauptmenüpunkt Neuer Lead', () => {
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.to === '/leads/new')).toBe(false);
  });

  it('öffnet die Beratung über die kanonische Advice-Route', async () => {
    renderAtRoute(SALES_WIZARD_NEW_PATH);
    expect(await screen.findByRole('heading', { name: 'Beratung' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Beratungsschritte' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kunde' })).toBeInTheDocument();
  });

  it('markiert Beratung bei /advice als aktiv und Arbeitsplatz nicht', async () => {
    renderAtRoute(SALES_WIZARD_NEW_PATH);
    await screen.findByRole('heading', { name: 'Beratung' });

    expect(navLinks('Beratung').every((link) => link.getAttribute('aria-current') === 'page')).toBe(
      true,
    );
    expect(navLinks('Arbeitsplatz').some((link) => link.getAttribute('aria-current') === 'page')).toBe(
      false,
    );
  });

  it('leitet die Legacy-Route /calculator/wizard auf /advice um', async () => {
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
    renderAtRoute(ADVICE_PATH);
    await screen.findByRole('heading', { name: 'Beratung' });
    const startLinks = screen.getAllByRole('link', { name: 'Beratung starten' });
    expect(startLinks).toHaveLength(1);
    expect(startLinks[0]).toHaveAttribute('href', SALES_WIZARD_NEW_PATH);
    expect(screen.queryByRole('link', { name: 'Schnelle Berechnung' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Neue Berechnung' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Zum Vertriebsprozess' })).not.toBeInTheDocument();
  });

  it('startet Beratung vom Arbeitsplatz', async () => {
    const user = userEvent.setup();
    const router = renderAtRoute('/sales');
    const link = await screen.findByRole('link', { name: 'Neue Beratung' });
    expect(link).toHaveAttribute('href', SALES_WIZARD_NEW_PATH);
    await user.click(link);
    expect(router.state.location.pathname).toBe(SALES_WIZARD_PATH);
    expect(router.state.location.search).toBe('?new=1');
  });

  it('verwendet beim Resume die kanonische Route und aktiven Navigationszustand', async () => {
    const user = userEvent.setup();
    const router = renderAtRoute(SALES_WIZARD_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    await user.click(screen.getByRole('button', { name: 'Neuen Kunden anlegen' }));
    await user.type(screen.getByLabelText('Firma'), 'Nav Resume GmbH');
    expect(await screen.findByText('Automatisch gespeichert')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Zum Arbeitsplatz' }));
    expect(router.state.location.pathname).toBe('/sales');
    expect(await screen.findByRole('heading', { name: 'Beratung fortsetzen' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Laufende Vorgänge' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pipeline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nächste Kundenfälle' })).not.toBeInTheDocument();

    await user.click(navLinks('Beratung')[0]!);
    expect(router.state.location.pathname).toBe(SALES_WIZARD_PATH);
    expect(await screen.findByRole('heading', { name: 'Beratung fortsetzen' })).toBeInTheDocument();
    const resumeLink = await screen.findByRole('link', { name: /Nav Resume GmbH/i });
    expect(resumeLink.getAttribute('href')).toMatch(/^\/advice\?session=/);
    await user.click(resumeLink);
    expect(router.state.location.pathname).toBe(SALES_WIZARD_PATH);
    expect(await screen.findByRole('heading', { name: 'Kunde' })).toBeInTheDocument();

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

  it('erlaubt Vorwärtsnavigation nur über Weiter, Rücksprung über die Schrittleiste', async () => {
    const user = userEvent.setup();
    renderAtRoute(SALES_WIZARD_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    const steps = within(screen.getByRole('navigation', { name: 'Beratungsschritte' }));
    await user.click(steps.getByRole('button', { name: /Ausgangslage/i }));
    expect(screen.getByRole('heading', { name: 'Kunde' })).toBeInTheDocument();
    expect(await screen.findByText(/Bitte mit „Weiter“ fortfahren/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ohne Kundenzuordnung beraten' }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(await screen.findByRole('heading', { name: 'Ausgangslage' })).toBeInTheDocument();

    await user.click(steps.getByRole('button', { name: /Kunde/i }));
    expect(await screen.findByRole('heading', { name: 'Kunde' })).toBeInTheDocument();
  });
});
