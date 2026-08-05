import type { Lead } from '../../../domain/lead/lead';
import type { BestPayComparisonSession } from '../../../domain/bestPayComparison/bestPayComparisonSession';
import { FormField } from '../../ui/FormField';
import { formatLeadSearchResult, type ProspectMode } from '../useAdviceSession';
import styles from '../AdviceWizard.module.css';

interface ProspectStepProps {
  session: BestPayComparisonSession;
  prospectMode: ProspectMode;
  leads: Lead[];
  leadSearch: string;
  selectedLeadId: string;
  busy: boolean;
  onLeadSearchChange: (value: string) => void;
  onProspectModeChange: (mode: ProspectMode) => void;
  onSelectLead: (leadId: string) => void;
  onPatchProspect: (patch: Partial<BestPayComparisonSession['wizard']['prospectDraft']>) => void;
  onPatchContactName: (name: string) => void;
}

export function ProspectStep({
  session,
  prospectMode,
  leads,
  leadSearch,
  selectedLeadId,
  busy,
  onLeadSearchChange,
  onProspectModeChange,
  onSelectLead,
  onPatchProspect,
  onPatchContactName,
}: ProspectStepProps) {
  const draft = session.wizard.prospectDraft;
  const contactName = [draft.contactFirstName, draft.contactLastName].filter(Boolean).join(' ');

  return (
    <div className={styles.stack}>
      <article className={styles.hero}>
        <h2 className={styles.sectionTitle}>Kunde</h2>
        <div className={styles.choiceRow}>
          {(
            [
              ['existing', 'Kunde suchen'],
              ['new', 'Neuen Kunden anlegen'],
              ['anonymous', 'Ohne Kundenzuordnung beraten'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={prospectMode === mode ? styles.choiceActive : styles.choiceButton}
              onClick={() => onProspectModeChange(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </article>

      {prospectMode === 'existing' ? (
        <article className={styles.card}>
          <h3 className={styles.sectionTitle}>Kunde suchen</h3>
          <FormField
            type="search"
            id="adviceLeadSearch"
            label="Suche"
            value={leadSearch}
            onChange={(event) => onLeadSearchChange(event.target.value)}
            placeholder="Firma, Ansprechpartner, Ort…"
          />
          {leads.length === 0 ? (
            <p className={styles.hint}>Keine Treffer. Suchbegriff anpassen.</p>
          ) : (
            <ul className={styles.leadResults} aria-label="Kundentreffer">
              {leads.map((lead) => {
                const isSelected = session.leadId === lead.id || selectedLeadId === lead.id;
                const lines = formatLeadSearchResult(lead);
                return (
                  <li key={lead.id}>
                    <button
                      type="button"
                      className={isSelected ? styles.leadSelected : styles.leadResult}
                      disabled={busy}
                      aria-pressed={isSelected}
                      onClick={() => onSelectLead(lead.id)}
                    >
                      <span className={styles.leadName}>{lines.company}</span>
                      {lines.contact ? (
                        <span className={styles.leadMeta}>{lines.contact}</span>
                      ) : null}
                      {lines.city ? <span className={styles.leadMeta}>{lines.city}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      ) : null}

      {prospectMode === 'new' ? (
        <article className={styles.card}>
          <h3 className={styles.sectionTitle}>Neuen Kunden anlegen</h3>
          <div className={styles.formGrid}>
            <FormField
              type="text"
              id="companyName"
              label="Firma"
              value={draft.companyName}
              onChange={(event) => onPatchProspect({ companyName: event.target.value })}
              placeholder="Optional, wenn Name bekannt ist"
            />
            <FormField
              type="text"
              id="contactName"
              label="Name"
              value={contactName}
              onChange={(event) => onPatchContactName(event.target.value)}
              placeholder="Optional, wenn Firma bekannt ist"
            />
            <FormField
              type="text"
              id="phone"
              label="Telefon (optional)"
              value={draft.phone}
              onChange={(event) => onPatchProspect({ phone: event.target.value })}
            />
            <FormField
              type="email"
              id="email"
              label="E-Mail (optional)"
              value={draft.email}
              onChange={(event) => onPatchProspect({ email: event.target.value })}
            />
          </div>
        </article>
      ) : null}

      {prospectMode === 'anonymous' ? (
        <article className={styles.card}>
          <p className={styles.hint}>
            Die Beratung wird ohne Kundenstamm durchgeführt. Sie können später einen Kunden
            zuordnen oder anlegen.
          </p>
        </article>
      ) : null}
    </div>
  );
}
