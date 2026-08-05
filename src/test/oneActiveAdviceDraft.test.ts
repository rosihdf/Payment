import { beforeEach, describe, expect, it } from 'vitest';
import { isActiveAdviceDraft } from '../domain/bestPayComparison/isActiveAdviceDraft';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import { createServices } from '../services';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestRepositories } from './helpers/createTestRepositories';
import { createValidLeadInput } from './helpers/leadTestHelpers';

const CONTEXT = {
  userId: 'user_001',
  role: 'field_service' as const,
  displayName: 'Laura Berger',
};

describe('Ein aktiver Beratungsentwurf pro Kunde', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('erkennt aktive Entwürfe und schließt Angebote aus', () => {
    const draft = createBestPayComparisonSession(CONTEXT.userId);
    draft.entryMode = 'wizard';
    draft.wizard.enabled = true;
    draft.leadId = 'lead_001';
    expect(isActiveAdviceDraft(draft)).toBe(true);

    draft.offerId = 'offer_1';
    expect(isActiveAdviceDraft(draft)).toBe(false);
  });

  it('zweiter Start und parallele Starts öffnen denselben Entwurf', async () => {
    const repos = createTestRepositories();
    const services = createServices(repos);
    const lead = await services.leadService.createLead(
      createValidLeadInput({ companyName: 'Ein Entwurf GmbH' }),
      CONTEXT.userId,
    );
    if (!lead.ok || !('lead' in lead)) {
      throw new Error('lead create failed');
    }

    const first = await services.salesWizardService.ensureActiveDraftForLead(lead.lead.id, CONTEXT);
    const second = await services.salesWizardService.ensureActiveDraftForLead(lead.lead.id, CONTEXT);
    expect(second.id).toBe(first.id);

    const [a, b] = await Promise.all([
      services.salesWizardService.ensureActiveDraftForLead(lead.lead.id, CONTEXT),
      services.salesWizardService.ensureActiveDraftForLead(lead.lead.id, CONTEXT),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.id).toBe(first.id);
  });

  it('Beratung mit Angebot blockiert keinen neuen Entwurf und erscheint nicht als aktiv', async () => {
    const repos = createTestRepositories();
    const services = createServices(repos);
    const lead = await services.leadService.createLead(
      createValidLeadInput({ companyName: 'Mit Angebot GmbH' }),
      CONTEXT.userId,
    );
    if (!lead.ok || !('lead' in lead)) {
      throw new Error('lead create failed');
    }

    const draft = await services.salesWizardService.ensureActiveDraftForLead(lead.lead.id, CONTEXT);
    draft.offerId = 'offer_test';
    draft.status = 'offer_created';
    await repos.bestPayComparisonRepository.save(draft);

    const again = await services.salesWizardService.findActiveDraftForLead(lead.lead.id, CONTEXT);
    expect(again).toBeNull();

    const fresh = await services.salesWizardService.ensureActiveDraftForLead(lead.lead.id, CONTEXT);
    expect(fresh.id).not.toBe(draft.id);
  });
});
