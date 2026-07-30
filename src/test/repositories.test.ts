import { beforeEach, describe, expect, it } from 'vitest';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { LocalUserRepository } from '../repositories/local/LocalUserRepository';
import {
  clearDemoDataForTests,
  getDemoLeads,
  getDemoTariffs,
  getDemoUsers,
  resetDemoDataForTests,
} from '../services/demoDataService';
import { createTestLead } from './helpers/leadTestHelpers';

describe('Repositories', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('loads demo users from LocalUserRepository', async () => {
    const repository = new LocalUserRepository();
    const users = await repository.getAll();

    expect(users).toHaveLength(4);
    expect(users.filter((user) => user.role === 'field_service')).toHaveLength(3);
    expect(users.filter((user) => user.role === 'admin')).toHaveLength(1);
  });

  it('returns current user and allows switching', async () => {
    const repository = new LocalUserRepository();
    const initialUser = await repository.getCurrentUser();

    expect(initialUser?.name).toBe('Laura Berger');

    const admin = getDemoUsers().find((user) => user.role === 'admin');
    expect(admin).toBeDefined();

    const switchedUser = await repository.setCurrentUser(admin!.id);
    expect(switchedUser?.role).toBe('admin');
  });

  it('loads demo leads from LocalLeadRepository', async () => {
    const repository = new LocalLeadRepository();
    const leads = await repository.getAll();

    expect(leads.length).toBeGreaterThanOrEqual(8);
    expect(await repository.count()).toBe(leads.length);
  });

  it('persists a new lead via LocalLeadRepository', async () => {
    const repository = new LocalLeadRepository();
    const initialCount = await repository.count();
    const lead = createTestLead();

    const created = await repository.create(lead);

    expect(await repository.count()).toBe(initialCount + 1);
    expect(await repository.getById('lead_test')).toEqual(created);
    expect(created.companyName).toBe('Repository Test');
  });

  it('loads demo tariffs from LocalTariffRepository', async () => {
    const repository = new LocalTariffRepository();
    const tariffs = await repository.getAll();

    expect(tariffs).toHaveLength(3);
    expect(tariffs.map((tariff) => tariff.name)).toEqual([
      'BestPay Start',
      'BestPay Business',
      'BestPay Flex',
    ]);
  });
});

describe('Demo data', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('provides expected demo users', () => {
    const users = getDemoUsers();
    expect(users).toHaveLength(4);
  });

  it('provides at least eight demo leads', () => {
    const leads = getDemoLeads();
    expect(leads.length).toBeGreaterThanOrEqual(8);
  });

  it('provides three demo tariffs', () => {
    const tariffs = getDemoTariffs();
    expect(tariffs).toHaveLength(3);
  });
});
