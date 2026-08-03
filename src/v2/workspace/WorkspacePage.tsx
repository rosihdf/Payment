import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { SalesDayWorkEntry } from '../../services/salesDayWorkspace';
import type { SalesWorkspaceView } from '../../services/salesWorkspaceService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { formatDateTime } from '../../utils/format';
import { ADVICE_NEW_PATH } from '../../utils/routes';
import { Button } from '../ui/Button';
import { DataList, DataListCard } from '../ui/DataList';
import { FormField } from '../ui/FormField';
import { PageHeader } from '../ui/PageHeader';
import styles from './WorkspacePage.module.css';

function DayWorkCard({ entry }: { entry: SalesDayWorkEntry }) {
  return (
    <DataListCard
      title={entry.companyName}
      meta={
        <>
          <span>{entry.standLabel}</span>
          <span>{entry.nextActionLabel}</span>
          <span>Fälligkeit: {entry.dueAt ? formatDateTime(entry.dueAt) : '–'}</span>
          {entry.warning ? <span>{entry.warning}</span> : null}
        </>
      }
      footer={
        entry.customerHref ? (
          <Link to={entry.customerHref}>Zur Kundenakte</Link>
        ) : undefined
      }
    />
  );
}

export function WorkspacePage() {
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
    const next = await salesWorkspaceService.getWorkspaceView(userContext, { scope, query });
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
    <section>
      <PageHeader
        title="Arbeitsplatz"
        description="Was heute konkret zu tun ist."
        actions={
          <div className={styles.headerActions}>
            <Link to={ADVICE_NEW_PATH}>
              <Button>Neue Beratung</Button>
            </Link>
            <Link to="/leads">
              <Button variant="secondary">Kunden suchen</Button>
            </Link>
            <Link to="/sales/commission">
              <Button variant="text">Meine Provision</Button>
            </Link>
          </div>
        }
      />

      <div className={styles.toolbar}>
        <FormField
          type="search"
          label="Suche"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kunde oder Aufgabe suchen…"
        />
        {currentUser.role === 'admin' ? (
          <FormField
            type="select"
            label="Ansicht"
            value={scope}
            onChange={(event) => setScope(event.target.value as 'mine' | 'team')}
          >
            <option value="mine">Meine Kunden</option>
            <option value="team">Team</option>
          </FormField>
        ) : null}
      </div>

      {isLoading || !view ? (
        <EmptyState title="Arbeitsplatz wird geladen" description="Tagesübersicht wird vorbereitet." />
      ) : (
        <div className={styles.sections}>
          {[
            { id: 'overdue', title: 'Überfällig', entries: view.dayWork.overdue },
            { id: 'today', title: 'Heute', entries: view.dayWork.today },
            { id: 'blocked', title: 'Blockiert', entries: view.dayWork.blocked },
            { id: 'next', title: 'Nächste Kundenfälle', entries: view.dayWork.nextCases },
          ].map((section) => (
            <section key={section.id} aria-labelledby={section.id}>
              <h2 id={section.id} className={styles.sectionTitle}>
                {section.title}
              </h2>
              {section.entries.length === 0 ? (
                <EmptyState title="Keine Einträge" description="In diesem Bereich ist nichts fällig." />
              ) : (
                <DataList
                  items={section.entries}
                  getKey={(entry) => entry.id}
                  renderItem={(entry) => <DayWorkCard entry={entry} />}
                />
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
