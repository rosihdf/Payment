import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { SalesDayWorkEntry } from '../../services/salesDayWorkspace';
import type { SalesWorkspaceView } from '../../services/salesWorkspaceService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { formatDateTime } from '../../utils/format';
import { formatPersistError } from '../../utils/persistError';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [scope] = useState<'mine'>('mine');
  const [query, setQuery] = useState('');
  const syncGenerationRef = useRef(0);
  const syncTimerRef = useRef<number | null>(null);
  const activeSyncRef = useRef<{ cancelled: boolean } | null>(null);

  const userContext = useMemo(
    () =>
      currentUser
        ? { userId: currentUser.id, role: currentUser.role, displayName: currentUser.name }
        : null,
    [currentUser],
  );

  const reload = useCallback(async () => {
    if (!userContext) {
      setIsLoading(false);
      return;
    }

    const generation = syncGenerationRef.current + 1;
    syncGenerationRef.current = generation;
    if (syncTimerRef.current != null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (activeSyncRef.current) {
      activeSyncRef.current.cancelled = true;
    }
    const syncControl = { cancelled: false };
    activeSyncRef.current = syncControl;
    setIsLoading(true);
    setLoadError(null);

    try {
      const next = await salesWorkspaceService.getWorkspaceView(userContext, { scope, query });
      if (syncGenerationRef.current !== generation) {
        return;
      }
      setView(next);
    } catch (error) {
      if (syncGenerationRef.current !== generation) {
        return;
      }
      setView(null);
      setLoadError(formatPersistError(error));
    } finally {
      if (syncGenerationRef.current === generation) {
        setIsLoading(false);
      }
    }

    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      if (syncGenerationRef.current !== generation) {
        return;
      }
      void salesWorkspaceService
        .syncAutomaticTasks(userContext, {
          isCancelled: () =>
            syncControl.cancelled || syncGenerationRef.current !== generation,
        })
        .then(async () => {
          if (syncGenerationRef.current !== generation) {
            return;
          }
          return salesWorkspaceService.getWorkspaceView(userContext, { scope, query });
        })
        .then((refreshed) => {
          if (!refreshed || syncGenerationRef.current !== generation) {
            return;
          }
          setView(refreshed);
          setSyncNotice(null);
        })
        .catch((error) => {
          console.error('Automatische Aufgaben-Synchronisation fehlgeschlagen:', error);
          if (syncGenerationRef.current === generation) {
            setSyncNotice('Automatische Aufgaben konnten nicht aktualisiert werden.');
          }
        });
    }, 250);
  }, [query, salesWorkspaceService, scope, userContext]);

  useEffect(() => {
    void reload();
    return () => {
      syncGenerationRef.current += 1;
      if (activeSyncRef.current) {
        activeSyncRef.current.cancelled = true;
      }
      if (syncTimerRef.current != null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
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
          placeholder="Kunde, Angebot oder Berechnung suchen…"
        />
      </div>

      {syncNotice ? <p role="status">{syncNotice}</p> : null}

      {!loadError && !isLoading && view && query.trim() ? (
        <section className={styles.searchSection} aria-labelledby="workspace-search-results">
          <h2 id="workspace-search-results" className={styles.searchTitle}>
            Suchtreffer
          </h2>
          {view.searchHits.length === 0 ? (
            <EmptyState
              title="Keine Treffer"
              description="Passen Sie die Suche an oder legen Sie einen neuen Kunden an."
            />
          ) : (
            <ul className={styles.searchHits}>
              {view.searchHits.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <Link className={styles.searchHitLink} to={hit.href}>
                    <div className={styles.searchHitTitle}>{hit.title}</div>
                    <div className={styles.searchHitSubtitle}>{hit.subtitle}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {loadError ? (
        <EmptyState
          title="Arbeitsplatz konnte nicht geladen werden"
          description={loadError}
          action={
            <Button variant="secondary" onClick={() => void reload()}>
              Erneut laden
            </Button>
          }
        />
      ) : isLoading || !view ? (
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
