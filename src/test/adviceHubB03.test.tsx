import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { SALES_WIZARD_VISIBLE_STEPS } from '../domain/bestPayComparison/salesWizard';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import {
  ADVICE_NEW_PATH,
  ADVICE_PATH,
  ADVICE_QUICK_PATH,
  LEGACY_SALES_WIZARD_PATH,
} from '../utils/routes';

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

describe('Aufräumblock 3 – Beratungshub', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it('/advice ist der sichtbare Beratungsstart mit einer dominanten Aktion', async () => {
    renderAtRoute(ADVICE_PATH);
    expect(await screen.findByRole('heading', { name: 'Beratung', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Beratung starten' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Beratung starten' })).toHaveAttribute(
      'href',
      ADVICE_NEW_PATH,
    );
  });

  it('stellt keinen parallelen Schnellrechner mehr dar', async () => {
    renderAtRoute(ADVICE_PATH);
    expect(await screen.findByRole('heading', { name: 'Beratung', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Schnelle Berechnung' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Schnelle Berechnung' })).not.toBeInTheDocument();
  });

  it('leitet /calculator mit Query-Parametern auf /advice um', async () => {
    const router = renderAtRoute('/calculator?leadId=lead_001&new=1');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ADVICE_PATH);
    });
    expect(router.state.location.search).toBe('?leadId=lead_001&new=1');
  });

  it('leitet /sales/wizard mit Query-Parametern auf /advice um', async () => {
    const router = renderAtRoute(`${LEGACY_SALES_WIZARD_PATH}?session=demo&foo=1`);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ADVICE_PATH);
    });
    expect(router.state.location.search).toBe('?session=demo&foo=1');
  });

  it('setzt bestehende Session fort ohne neue Session zu erzeugen', async () => {
    const user = userEvent.setup();
    const router = renderAtRoute(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    await user.click(screen.getByRole('button', { name: 'Neuer Kunde' }));
    await user.type(screen.getByLabelText('Firma'), 'Resume Café');
    expect(await screen.findByText('Autosave aktiv')).toBeInTheDocument();
    const persistedId = new URLSearchParams(router.state.location.search).get('session');
    expect(persistedId).toBeTruthy();

    await user.click(screen.getByRole('link', { name: 'Zum Arbeitsplatz' }));
    expect(await screen.findByRole('heading', { name: 'Arbeitsplatz' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: 'Beratung' })[0]!);
    expect(router.state.location.pathname).toBe(ADVICE_PATH);
    expect(await screen.findByRole('heading', { name: 'Beratung fortsetzen' })).toBeInTheDocument();

    const resume = screen.getAllByRole('link').find((link) => {
      const href = link.getAttribute('href') ?? '';
      return href.includes(`session=${persistedId}`) && /Fortsetzen/.test(link.textContent ?? '');
    });
    expect(resume).toBeTruthy();

    await user.click(resume!);
    expect(router.state.location.pathname).toBe(ADVICE_PATH);
    expect(router.state.location.search).toBe(`?session=${persistedId}`);
    await screen.findByRole('heading', { name: 'Kunde' });
    expect(screen.getAllByText('Beratung fortgesetzt').length).toBeGreaterThan(0);
    expect(screen.getByText('Autosave aktiv')).toBeInTheDocument();
  });

  it('zeigt maximal sechs sichtbare Schritte ohne Wizard/Abschluss', async () => {
    renderAtRoute(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    expect(SALES_WIZARD_VISIBLE_STEPS).toHaveLength(6);
    const steps = within(screen.getByRole('navigation', { name: 'Beratungsschritte' }));
    expect(steps.getAllByRole('button')).toHaveLength(6);
    expect(steps.queryByRole('button', { name: /Abschluss$/i })).not.toBeInTheDocument();
    expect(steps.getByRole('button', { name: /Prüfung & Nachfassen/i })).toBeInTheDocument();
    expect(screen.queryByText(/Wizard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vertriebsprozess/i)).not.toBeInTheDocument();
  });

  it('erhält Kundenbezug über leadId', async () => {
    renderAtRoute(`${ADVICE_PATH}?leadId=lead_001`);
    expect(await screen.findByRole('heading', { name: 'Kunde' })).toBeInTheDocument();
    const select = await screen.findByLabelText('Kunde auswählen');
    expect((select as HTMLSelectElement).value).toBe('lead_001');
  });

  it('ermöglicht Beratung ohne Kundenbezug', async () => {
    renderAtRoute(ADVICE_NEW_PATH);
    await screen.findByRole('heading', { name: 'Kunde' });
    expect(screen.getByRole('button', { name: 'Ohne Kunde rechnen' })).toBeInTheDocument();
  });

  it('leitet parallele Rechner-Deep-Links auf /advice um', async () => {
    const historyRouter = renderAtRoute('/calculator/bestpay/history');
    await waitFor(() => {
      expect(historyRouter.state.location.pathname).toBe(ADVICE_PATH);
    });

    const quickRouter = renderAtRoute(ADVICE_QUICK_PATH);
    await waitFor(() => {
      expect(quickRouter.state.location.pathname).toBe(ADVICE_PATH);
    });
  });
});
