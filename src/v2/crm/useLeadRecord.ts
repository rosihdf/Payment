import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import type { Lead } from '../../domain/lead/lead';
import type { Contact } from '../../domain/contact/contact';
import type { SalesActivity } from '../../domain/salesWorkspace/salesActivity';
import type { SalesTask } from '../../domain/salesWorkspace/salesTask';
import type { Offer } from '../../domain/offer/offer';
import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import type { CustomerDocumentRef } from '../../services/customerDocumentAggregationService';
import type { ContractListItem } from '../../domain/contract/contract';
import type { ActivationListItem } from '../../domain/activation/activationCase';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';

export type LeadRecordTab =
  | 'overview'
  | 'cases'
  | 'contacts'
  | 'documents'
  | 'sales'
  | 'masterdata';

export function useLeadRecord(activeTab: LeadRecordTab) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { currentUser } = useCurrentUser();
  const services = useServices();

  const [lead, setLead] = useState<Lead | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [timeline, setTimeline] = useState<SalesActivity[]>([]);
  const [tasks, setTasks] = useState<SalesTask[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sessions, setSessions] = useState<BestPayComparisonSession[]>([]);
  const [documents, setDocuments] = useState<CustomerDocumentRef[]>([]);
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [activations, setActivations] = useState<ActivationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void services.leadService.getLeadById(id).then((result) => {
      setLead(result);
      setIsLoading(false);
    });
  }, [id, services.leadService, location.key, reloadToken]);

  useEffect(() => {
    if (!id || !currentUser) {
      return;
    }
    const offerContext = {
      userId: currentUser.id,
      role: currentUser.role,
      displayName: currentUser.name,
    };
    const userContext = {
      userId: currentUser.id,
      role: currentUser.role,
      displayName: currentUser.name,
      status: currentUser.status,
    };

    if (activeTab === 'contacts') {
      // Primärkontakt nur im Kontakt-Tab sicherstellen – sonst Side Effects beim bloßen Öffnen.
      void services.contactService.ensurePrimaryFromLead(id, userContext).then(async () => {
        const listed = await services.contactService.listByLead(id, userContext, {
          includeInactive: true,
        });
        if (listed.ok) {
          setContacts(listed.contacts);
        }
      });
    } else if (activeTab === 'overview' || activeTab === 'cases') {
      void services.contactService
        .listByLead(id, userContext, { includeInactive: true })
        .then((listed) => {
          if (listed.ok) {
            setContacts(listed.contacts);
          }
        });
    }

    if (activeTab === 'cases' || activeTab === 'overview') {
      void services.salesActivityService
        .getTimelineForLead(id, offerContext, { limit: 200 })
        .then(setTimeline);
      void services.salesTaskService.listVisible(offerContext).then((visible) => {
        setTasks(visible.filter((task) => task.leadId === id));
      });
    }

    if (activeTab === 'sales' || activeTab === 'overview') {
      void services.offerService.getOffersForLead(id, offerContext).then(setOffers);
      void services.salesWorkspaceService.getLeadWorkspaceSummary(id, offerContext).then((summary) => {
        setSessions(summary?.sessions ?? []);
      });
      void services.contractService.list(userContext, { status: 'all' }).then((result) => {
        if (result.ok) {
          setContracts(result.value.filter((contract) => contract.leadId === id));
        }
      });
      void services.activationService.list(userContext, { status: 'all' }).then((result) => {
        if (result.ok) {
          setActivations(result.value.filter((activation) => activation.leadId === id));
        }
      });
    }

    if (activeTab === 'documents') {
      void services.customerDocumentAggregationService.listForLead(id).then(setDocuments);
    }
  }, [activeTab, currentUser, id, services, reloadToken]);

  return {
    id,
    lead,
    contacts,
    timeline,
    tasks,
    offers,
    sessions,
    documents,
    contracts,
    activations,
    isLoading,
    reload,
    currentUser,
  };
}
