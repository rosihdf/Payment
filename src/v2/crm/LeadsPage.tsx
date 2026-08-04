import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { EditLeadInput, Lead } from '../../domain/lead/lead';
import { LEAD_STATUS_LABELS } from '../../domain/lead/lead';
import { getLeadDisplayName } from '../../domain/lead/getLeadDisplayName';
import { leadToEditInput } from '../../domain/lead/leadFormMapping';
import type { User } from '../../domain/user/user';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import {
  getCardMixSummary,
  isCardMixValid,
  type CreateLeadErrors,
} from '../../services/leadValidation';
import { formatContactName } from '../../utils/format';
import { Button } from '../ui/Button';
import { DataList, DataListCard } from '../ui/DataList';
import { Dialog } from '../ui/Dialog';
import { FormField } from '../ui/FormField';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import { LeadForm } from './LeadForm';
import styles from './LeadsPage.module.css';

export function LeadsPage() {
  const location = useLocation();
  const { currentUser } = useCurrentUser();
  const { leadService, userService } = useServices();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditLeadInput | null>(null);
  const [editErrors, setEditErrors] = useState<CreateLeadErrors>({});
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);

  const canAssignAdvisor = currentUser?.role === 'admin';

  const advisorOptions = useMemo(
    () =>
      users
        .filter((user) => user.role === 'field_service' && user.status === 'active')
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        })),
    [users],
  );

  const reloadLeads = useCallback(() => {
    if (!currentUser) {
      return;
    }
    setIsLoading(true);
    void leadService
      .searchLeads(query, { userId: currentUser.id, role: currentUser.role })
      .then((result) => {
        setLeads(result);
        setIsLoading(false);
      });
  }, [currentUser, leadService, query]);

  useEffect(() => {
    if (!currentUser) {
      setUsers([]);
      return;
    }
    void userService.getAllUsers().then(setUsers);
  }, [currentUser, userService]);

  useEffect(() => {
    if (!canAssignAdvisor || !editingLeadId) {
      return;
    }
    void userService.getAllUsers().then(setUsers);
  }, [canAssignAdvisor, editingLeadId, userService]);

  useEffect(() => {
    reloadLeads();
  }, [reloadLeads, location.key]);

  useEffect(() => {
    if (!editingLeadId) {
      setEditValues(null);
      return;
    }
    setIsEditLoading(true);
    setEditErrors({});
    void leadService.getLeadById(editingLeadId).then((lead) => {
      if (lead) {
        setEditValues(leadToEditInput(lead));
      } else {
        setEditingLeadId(null);
        showToast('Kunde nicht gefunden', 'error');
      }
      setIsEditLoading(false);
    });
  }, [editingLeadId, leadService, showToast]);

  const getUserName = (userId: string): string =>
    users.find((user) => user.id === userId)?.name ?? 'Unbekannt';

  const closeEditDialog = () => {
    if (isEditSubmitting) {
      return;
    }
    setEditingLeadId(null);
    setEditValues(null);
    setEditErrors({});
  };

  const handleEditSubmit = () => {
    if (!currentUser || !editingLeadId || !editValues || isEditSubmitting) {
      return;
    }
    void (async () => {
      setIsEditSubmitting(true);
      setEditErrors({});
      const result = await leadService.updateLead(editingLeadId, editValues, {
        userId: currentUser.id,
        role: currentUser.role,
      });
      if (!result.ok) {
        if ('errors' in result) {
          setEditErrors(result.errors);
          showToast('Bitte prüfen Sie die markierten Felder.', 'error');
        } else {
          showToast('Änderungen konnten nicht gespeichert werden', 'error');
        }
        setIsEditSubmitting(false);
        return;
      }
      showToast('Änderungen wurden gespeichert', 'success');
      setIsEditSubmitting(false);
      closeEditDialog();
      reloadLeads();
    })();
  };

  const cardMixSummary = editValues ? getCardMixSummary(editValues.cardMix) : '';

  return (
    <section>
      <PageHeader
        title="Kunden"
        description="Kunden und Interessenten – Ausgangspunkt für Beratung, Angebot und Onboarding"
        actions={
          <Link to="/leads/new">
            <Button>Neuer Kunde</Button>
          </Link>
        }
      />

      <div className={styles.search}>
        <FormField
          type="search"
          label="Kunden-Suche"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Firma, Kontakt, Ort, Anbieter oder E-Mail suchen…"
        />
      </div>

      {isLoading ? (
        <EmptyState title="Kunden werden geladen" description="Die Kundenliste wird vorbereitet." />
      ) : leads.length === 0 ? (
        <EmptyState
          title="Keine Kunden gefunden"
          description="Passen Sie die Suche an oder legen Sie einen neuen Kunden an."
          action={
            <Link to="/leads/new">
              <Button>Neuer Kunde</Button>
            </Link>
          }
        />
      ) : (
        <DataList
          items={leads}
          getKey={(lead) => lead.id}
          aria-label="Kundenliste"
          renderItem={(lead) => (
            <DataListCard
              href={`/leads/${lead.id}`}
              title={getLeadDisplayName(lead)}
              badge={<StatusBadge variant="neutral" label={LEAD_STATUS_LABELS[lead.status]} />}
              meta={
                <>
                  <span>{formatContactName(lead.contactFirstName, lead.contactLastName)}</span>
                  <span>{lead.city || 'Ort nicht angegeben'}</span>
                  <span>{lead.phone || 'Telefon nicht angegeben'}</span>
                  <span>{lead.email || 'E-Mail nicht angegeben'}</span>
                  <span>{lead.industry || 'Branche nicht angegeben'}</span>
                  <span>Betreuer: {getUserName(lead.assignedSalesUserId)}</span>
                </>
              }
              footer={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEditingLeadId(lead.id);
                  }}
                >
                  Bearbeiten
                </Button>
              }
            />
          )}
        />
      )}

      <Dialog
        isOpen={Boolean(editingLeadId)}
        title="Kunde bearbeiten"
        onClose={closeEditDialog}
        secondaryAction={{ label: 'Abbrechen', onClick: closeEditDialog, disabled: isEditSubmitting }}
        primaryAction={
          editValues && !isEditLoading
            ? {
                label: 'Speichern',
                onClick: handleEditSubmit,
                loading: isEditSubmitting,
                disabled: isEditSubmitting,
              }
            : undefined
        }
      >
        {isEditLoading || !editValues ? (
          <EmptyState title="Kunde wird geladen" description="Die Kundendaten werden abgerufen." />
        ) : (
          <LeadForm
            mode="edit"
            values={editValues}
            errors={editErrors}
            cardMixSummary={cardMixSummary}
            isCardMixValid={isCardMixValid(editValues.cardMix)}
            isSubmitting={isEditSubmitting}
            onChange={setEditValues}
            onSubmit={handleEditSubmit}
            onCancel={closeEditDialog}
            canAssignAdvisor={canAssignAdvisor}
            advisorOptions={advisorOptions}
          />
        )}
      </Dialog>
    </section>
  );
}
