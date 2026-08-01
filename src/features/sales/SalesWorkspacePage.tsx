import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FormField } from '../../components/common/FormField';
import { SearchField } from '../../components/common/SearchField';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import type { SalesDayWorkEntry } from '../../services/salesDayWorkspace';
import type { SalesWorkspaceView } from '../../services/salesWorkspaceService';
import { formatDateTime } from '../../utils/format';
import { ADVICE_NEW_PATH } from '../../utils/routes';
import styles from './SalesWorkspacePage.module.css';

function DayWorkCard({
  entry,
  showTaskTitle = false,
}: {
  entry: SalesDayWorkEntry;
  showTaskTitle?: boolean;
}) {
  const href = entry.customerHref;
  return (
    <article className={entry.warning === 'Überfällig' ? `${styles.card} ${styles.cardOverdue}` : styles.card}>
      <h3 className={styles.cardTitle}>
        {href ? (
          <Link className={styles.cardTitleLink} to={href}>
            {entry.companyName}
          </Link>
        ) : (
          entry.companyName
        )}
      </h3>
      <p className={styles.cardMeta}>Stand: {entry.standLabel}</p>
      {showTaskTitle && entry.taskTitle ? (
        <p className={styles.cardMeta}>Aufgabe: {entry.taskTitle}</p>
      ) : null}
      <p className={styles.cardMeta}>Hauptaktion: {entry.nextActionLabel}</p>
      <p className={styles.cardMeta}>
        Fälligkeit: {entry.dueAt ? formatDateTime(entry.dueAt) : '–'}
      </p>
      {entry.warning ? (
        <p className={styles.warningText}>{entry.warning}</p>
      ) : null}
      <div className={styles.actions}>
        {href ? (
          <Link className={styles.primaryAction} to={href}>
            Zur Kundenakte
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function DaySection({
  id,
  title,
  emptyTitle,
  emptyDescription,
  entries,
  showTaskTitle = false,
}: {
  id: string;
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  entries: SalesDayWorkEntry[];
  showTaskTitle?: boolean;
}) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {entries.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <DayWorkCard entry={entry} showTaskTitle={showTaskTitle} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SalesWorkspacePage() {
  const { currentUser } = useCurrentUser();
  const { salesWorkspaceService } = useServices();

  const [view, setView] = useState<SalesWorkspaceView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const [query, setQuery] = useState('');

  const userContext = useMemo(
    () =>
      currentUser
        ? { userId: currentUser.id, role: currentUser.role, displayName: currentUser.name }
        : null,
    [currentUser],
  );

  const reload = useCallback(async () => {
    if (!userContext) {
      return;
    }
    setIsLoading(true);
    const next = await salesWorkspaceService.getWorkspaceView(userContext, {
      scope,
      query,
    });
    setView(next);
    setIsLoading(false);
  }, [query, salesWorkspaceService, scope, userContext]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!currentUser || !userContext) {
    return <EmptyState title="Kein Benutzer" description="Bitte melden Sie sich an." />;
  }

  return (
    <section className={styles.page}>
      <PageHeader
        title="Arbeitsplatz"
        subtitle="Was heute konkret zu tun ist."
        actions={
          <div className={styles.headerActions}>
            <Link className={styles.primaryAction} to={ADVICE_NEW_PATH}>
              Neue Beratung
            </Link>
            <Link className={styles.secondaryAction} to="/leads">
              Kunden suchen
            </Link>
          </div>
        }
      />

      <div className={styles.toolbar}>
        <SearchField
          label="Kunden filtern"
          value={query}
          onChange={setQuery}
          placeholder="Firma, Ansprechpartner…"
        />
        {view?.canUseTeamScope ? (
          <FormField label="Sicht" id="sales-scope">
            <select
              id="sales-scope"
              value={scope}
              onChange={(event) => setScope(event.target.value as 'mine' | 'team')}
            >
              <option value="mine">Meine Fälle</option>
              <option value="team">Team</option>
            </select>
          </FormField>
        ) : null}
      </div>

      {view?.searchHits.length ? (
        <section className={styles.section} aria-labelledby="search-heading">
          <h2 id="search-heading" className={styles.sectionTitle}>
            Suchtreffer
          </h2>
          <ul className={styles.list}>
            {view.searchHits
              .filter((hit) => hit.kind === 'lead')
              .map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <Link className={styles.secondaryAction} to={hit.href}>
                    {hit.title} – {hit.subtitle}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {isLoading || !view ? (
        <EmptyState
          title="Arbeitsplatz wird geladen"
          description="Tagesaufgaben werden vorbereitet."
        />
      ) : (
        <div className={styles.dayStack}>
          <DaySection
            id="overdue-heading"
            title="Überfällig"
            emptyTitle="Nichts überfällig"
            emptyDescription="Keine überfälligen Wiedervorlagen oder Aufgaben."
            entries={view.dayWork.overdue}
            showTaskTitle
          />
          <DaySection
            id="today-heading"
            title="Heute"
            emptyTitle="Heute nichts geplant"
            emptyDescription="Keine heute fälligen Wiedervorlagen, Freigaben oder Aktivierungsschritte."
            entries={view.dayWork.today}
            showTaskTitle
          />
          <DaySection
            id="blocked-heading"
            title="Blockiert"
            emptyTitle="Keine blockierten Fälle"
            emptyDescription="Keine harten Blocker oder blockierenden Freigaben."
            entries={view.dayWork.blocked}
          />
          <DaySection
            id="next-heading"
            title="Nächste Kundenfälle"
            emptyTitle="Keine weiteren Kundenfälle"
            emptyDescription="Aktuell keine weiteren Fälle mit Handlungsbedarf."
            entries={view.dayWork.nextCases}
          />
        </div>
      )}
    </section>
  );
}
