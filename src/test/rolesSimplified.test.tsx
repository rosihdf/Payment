import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { ASSIGNABLE_USER_ROLES, USER_ROLE_LABELS } from '../domain/user/user';
import { mapLegacyUserRole, normalizeUser } from '../domain/user/normalizeUser';
import { hasPermission } from '../domain/permission/permission';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createUserContext } from '../services/auditService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { MOBILE_NAV_ITEMS, SIDEBAR_NAV_ITEMS, filterNavItemsByRole } from '../utils/navigation';
import { LocalUserRepository } from '../repositories/local/LocalUserRepository';
import { LocalAuditRepository } from '../repositories/local/LocalAuditRepository';
import { AdminUserService } from '../services/adminUserService';
import { AuditService } from '../services/auditService';
import { openFormSelect } from './helpers/selectFormOption';

function renderApp(initialRoute = '/', currentUserId = 'user_001') {
  clearDemoDataForTests();
  resetDemoDataForTests();
  writeStorageItem(STORAGE_KEYS.currentUserId, currentUserId);

  const memoryRouter = createMemoryRouter(appRoutes, {
    initialEntries: [initialRoute],
  });

  return render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );
}

describe('Aufräumblock 2 – Rollen vereinfacht', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('kennt nur Administrator und Außendienst als auswählbare Rollen', () => {
    expect(ASSIGNABLE_USER_ROLES).toEqual(['admin', 'field_service']);
    expect(USER_ROLE_LABELS.admin).toBe('Administrator');
    expect(USER_ROLE_LABELS.field_service).toBe('Außendienst');
  });

  it('normalisiert Altrollen konservativ', () => {
    expect(mapLegacyUserRole('sales_lead')).toBe('admin');
    expect(mapLegacyUserRole('sales_manager')).toBe('admin');
    expect(mapLegacyUserRole('reviewer')).toBe('admin');
    expect(mapLegacyUserRole('approver')).toBe('admin');
    expect(mapLegacyUserRole('readonly')).toBe('field_service');
    expect(mapLegacyUserRole('read_only')).toBe('field_service');

    const migrated = normalizeUser({
      id: 'legacy_1',
      name: 'Alt',
      role: 'sales_lead',
    });
    expect(migrated?.role).toBe('admin');
  });

  it('persistiert nur normalisierte Rollen aus Demo-Storage', async () => {
    const repository = new LocalUserRepository();
    const users = await repository.getAll();
    expect(users).toHaveLength(6);
    expect(users.every((user) => ASSIGNABLE_USER_ROLES.includes(user.role))).toBe(true);
    expect(users.filter((user) => user.role === 'field_service')).toHaveLength(3);
    expect(users.filter((user) => user.role === 'admin')).toHaveLength(3);
  });

  it('schützt den letzten Administrator', async () => {
    const admin = createUserContext({
      id: 'user_004',
      role: 'admin',
      name: 'Michael Weber',
      status: 'active',
    });
    const service = new AdminUserService(new LocalUserRepository(), new AuditService(new LocalAuditRepository()));

    // Alle anderen Admins deaktivieren, bis nur Michael übrig ist
    for (const id of ['user_003', 'user_005']) {
      const result = await service.deactivateUser(admin, id);
      expect(result.ok).toBe(true);
    }

    const protectedResult = await service.deactivateUser(admin, 'user_004');
    expect(protectedResult.ok).toBe(false);
    if (!protectedResult.ok) {
      expect(protectedResult.error).toBe('protected');
    }
  });

  it('Demo-Auswahl enthält keine Altrollen und Profil bleibt erreichbar', async () => {
    const user = userEvent.setup();
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Arbeitsplatz' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Demo-Benutzer wechseln' })).toHaveAttribute(
        'data-value',
        'user_001',
      );
    });

    await openFormSelect(user, 'Demo-Benutzer wechseln');
    await waitFor(() => {
      const values = screen.getAllByRole('option').map((option) => option.getAttribute('data-value'));
      expect(values).toContain('user_001');
      expect(values).toContain('user_004');
    });
    const options = screen.getAllByRole('option').map((option) => option.textContent ?? '');
    expect(options.every((text) => !text.includes('(Vertriebsleitung)'))).toBe(true);
    expect(options.every((text) => !text.includes('(Prüfer)'))).toBe(true);
    expect(options.every((text) => !text.includes('(Nur Lesen)'))).toBe(true);

    expect(screen.getAllByRole('link', { name: 'Profil' })[0]).toHaveAttribute('href', '/profile');
  });

  it('Außendienst sieht keine Verwaltung, Administrator schon', () => {
    expect(filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'field_service').some((item) => item.to === '/admin')).toBe(
      false,
    );
    expect(filterNavItemsByRole(SIDEBAR_NAV_ITEMS, 'admin').some((item) => item.to === '/admin')).toBe(true);
    expect(hasPermission('field_service', 'admin.access')).toBe(false);
    expect(hasPermission('admin', 'admin.access')).toBe(true);
  });

  it('Profil ist in Desktop- und Mobile-Navigation', () => {
    expect(SIDEBAR_NAV_ITEMS.some((item) => item.label === 'Profil')).toBe(true);
    expect(MOBILE_NAV_ITEMS.some((item) => item.label === 'Profil')).toBe(true);
  });

  it('Rollen-Verwaltung ist in die Benutzerseite integriert', async () => {
    renderApp('/admin/roles', 'user_004');
    expect(await screen.findByRole('heading', { name: 'Benutzer' })).toBeInTheDocument();
  });
});
