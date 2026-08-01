import { useMemo, useState } from 'react';
import { FormControl } from '../../components/common/FormControl';
import type { Lead } from '../../domain/lead/lead';
import { formatContactName } from '../../utils/format';
import formStyles from './OfferForm.module.css';

interface OfferCustomerSectionProps {
  leads: Lead[];
  leadId: string;
  error?: string;
  disabled?: boolean;
  onChange: (leadId: string) => void;
}

export function OfferCustomerSection({
  leads,
  leadId,
  error,
  disabled = false,
  onChange,
}: OfferCustomerSectionProps) {
  const [search, setSearch] = useState('');

  const filteredLeads = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return leads;
    }

    return leads.filter((lead) => {
      const haystack = [
        lead.companyName,
        lead.contactFirstName,
        lead.contactLastName,
        lead.city,
        lead.email,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [leads, search]);

  const selectedLead = leads.find((lead) => lead.id === leadId) ?? null;

  return (
    <section className={formStyles.section}>
      <h2 className={formStyles.sectionTitle}>Kunde</h2>

      <FormControl
        type="search"
        label="Lead suchen"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Firma, Kontakt, Ort oder E-Mail…"
      />

      <FormControl
        type="select"
        id="leadId"
        label="Lead"
        required
        error={error}
        value={leadId}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Lead auswählen…</option>
        {filteredLeads.map((lead) => (
          <option key={lead.id} value={lead.id}>
            {lead.companyName} – {formatContactName(lead.contactFirstName, lead.contactLastName)}
            {lead.city ? ` (${lead.city})` : ''}
          </option>
        ))}
      </FormControl>

      {selectedLead ? (
        <dl className={formStyles.preview}>
          <div className={formStyles.previewRow}>
            <dt>Firma</dt>
            <dd>{selectedLead.companyName}</dd>
          </div>
          <div className={formStyles.previewRow}>
            <dt>Ansprechpartner</dt>
            <dd>
              {formatContactName(selectedLead.contactFirstName, selectedLead.contactLastName)}
            </dd>
          </div>
          <div className={formStyles.previewRow}>
            <dt>Anschrift</dt>
            <dd>
              {[selectedLead.street, `${selectedLead.postalCode} ${selectedLead.city}`.trim()]
                .filter(Boolean)
                .join(', ') || '—'}
            </dd>
          </div>
          <div className={formStyles.previewRow}>
            <dt>Kontakt</dt>
            <dd>
              {[selectedLead.phone, selectedLead.email].filter(Boolean).join(' · ') || '—'}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
