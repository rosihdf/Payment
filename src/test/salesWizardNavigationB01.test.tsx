import { render, screen, waitFor } from '@testing-library/react';
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
  salesWizardSessionPath,
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

function processNavLink() {
  return screen.getByRole('link', { name: 'Vertriebsprozess', hidden: true });
}

function calculatorNavLink() {
  return screen.getByRole('link', { name: 'Rechner', hidden: true });
}

describe('B01 Vertriebsprozess Navigation', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('enthält einen sichtbaren Hauptnavigationseintrag Vertriebsprozess', () => {
    expect(
      SIDEBAR_NAV_ITEMS.some(
        (item) => item.to === SALES_WIZARD_PATH && item.label === 'Vertriebsprozess',
      ),
    ).toBe(true);
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.label === 'Vertriebs-Wizard')).toBe(false);
  });

  it('enthält keinen Hauptmenüpunkt Neuer Lead', () => {
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.to === '/leads/new')).toBe(false);
  });

  it('öffnet den Vertriebsprozess über die kanonische Route', async () => {
    renderAtRoute(SALES_WIZARD_NEW_PATH);
    expect(await screen.findByRole('heading', { name: 'BestPay Vertriebsprozess' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Prozessschritte' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Interessent' })).toBeInTheDocument();
  });

  it('markiert Vertriebsprozess bei /sales/wizard als aktiv und Rechner nicht', async () => {
    renderAtRoute(SALES_WIZARD_NEW_PATH);
    await screen.findByRole('heading', { name: 'BestPay Vertriebsprozess' });

    expect(processNavLink()).toHaveAttribute('aria-current', 'page');
    expect(calculatorNavLink()).not.toHaveAttribute('aria-current', 'page');
  });

  it('leitet die Legacy-Route /calculator/wizard auf /sales/wizard um', async () => {
    const router = renderAtRoute(`${CALCULATOR_WIZARD_LEGACY_PATH}?new=1`);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SALES_WIZARD_PATH);
    });
    expect(router.state.location.search).toBe('?new=1');
    expect(await screen.findByRole('heading', { name: 'BestPay Vertriebsprozess' })).toBeInTheDocument();

    expect(processNavLink()).toHaveAttribute('aria-current', 'page');
  });

  it('zeigt im Rechner-Hub keinen Vertriebsprozess als Hauptkachel', async () => {
    renderAtRoute('/calculator');
    await screen.findByRole('heading', { name: 'Rechner' });
    expect(screen.queryByRole('link', { name: 'Vertriebsprozess' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vertriebs-Wizard' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Neue Berechnung' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zum Vertriebsprozess' })).toHaveAttribute(
      'href',
      SALES_WIZARD_PATH,
    );
  });

  it('startet Neuen Vertriebsfall direkt im Vertriebsprozess', async () => {
    const user = userEvent.setup();
    const router = renderAtRoute('/sales');
    const link = await screen.findByRole('link', { name: 'Neuen Vertriebsfall starten' });
    expect(link).toHaveAttribute('href', SALES_WIZARD_NEW_PATH);
    await user.click(link);
    expect(router.state.location.pathname).toBe(SALES_WIZARD_PATH);
    expect(router.state.location.search).toBe('?new=1');
  });

  it('verwendet beim Resume die kanonische Route und aktiven Navigationszustand', async () => {
    const user = userEvent.setup();
    const router = renderAtRoute(SALES_WIZARD_NEW_PATH);
    await screen.findByRole('heading', { name: 'Interessent' });

    await user.click(screen.getByRole('link', { name: 'Zum Vertriebsarbeitsplatz' }));
    expect(router.state.location.pathname).toBe('/sales');
    expect(await screen.findByRole('heading', { name: 'Laufende Vorgänge' })).toBeInTheDocument();

    const resumeLink = await screen.findByRole('link', { name: /^Vorgang fortsetzen:/ });
    expect(resumeLink.getAttribute('href')).toMatch(/^\/sales\/wizard\?session=/);

    await user.click(resumeLink);
    expect(router.state.location.pathname).toBe(SALES_WIZARD_PATH);
    expect(await screen.findByRole('heading', { name: 'BestPay Vertriebsprozess' })).toBeInTheDocument();

    expect(processNavLink()).toHaveAttribute('aria-current', 'page');
    expect(calculatorNavLink()).not.toHaveAttribute('aria-current', 'page');
  });

  it('lässt Lead-Neuanlage über die Lead-Übersicht zu', async () => {
    renderAtRoute('/leads');
    expect(await screen.findByRole('link', { name: 'Neuer Lead' })).toHaveAttribute(
      'href',
      '/leads/new',
    );
  });

  it('navigiert per Schrittleiste und speichert Fortschritt', async () => {
    const user = userEvent.setup();
    renderAtRoute(SALES_WIZARD_NEW_PATH);
    await screen.findByRole('heading', { name: 'Interessent' });

    await user.click(screen.getByRole('button', { name: /Aktuelle Kosten/ }));
    expect(await screen.findByRole('heading', { name: 'Aktuelle Kosten' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('heading', { name: 'Interessent' })).toBeInTheDocument();
  });
});

describe('Resume route helper', () => {
  it('baut kanonische Session-Links', () => {
    expect(salesWizardSessionPath('session_123')).toBe('/sales/wizard?session=session_123');
  });
});
