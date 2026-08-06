import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import type { Lead } from '../../domain/lead/lead';
import type { Offer } from '../../domain/offer/offer';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';

/** Lädt Stammdaten und Angebote für die vereinfachte Kunden-Detailseite. */
export function useLeadRecord() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { currentUser } = useCurrentUser();
  const services = useServices();

  const [lead, setLead] = useState<Lead | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    if (!id) {
      setLead(null);
      setIsLoading(false);
      return;
    }
    if (!currentUser) {
      return;
    }
    setIsLoading(true);
    void services.leadService
      .getLeadById(id, { userId: currentUser.id, role: currentUser.role })
      .then((result) => {
        setLead(result);
        setIsLoading(false);
      });
  }, [id, services.leadService, location.key, reloadToken, currentUser]);

  useEffect(() => {
    if (!id || !currentUser) {
      return;
    }
    const offerContext = {
      userId: currentUser.id,
      role: currentUser.role,
      displayName: currentUser.name,
    };
    void services.offerService.getOffersForLead(id, offerContext).then(setOffers);
  }, [currentUser, id, services.offerService, reloadToken]);

  return {
    id,
    lead,
    offers,
    isLoading,
    reload,
    currentUser,
  };
}
