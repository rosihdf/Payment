import { useEffect, useState, type FormEvent } from 'react';
import {
  ASSIGNABLE_USER_ROLES,
  USER_ROLE_DESCRIPTIONS,
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  type User,
  type UserRole,
  type UserStatus,
} from '../../domain/user/user';
import { EmptyState } from '../../components/feedback/EmptyState';
import { FormField } from '../../components/common/FormField';
import { SearchField } from '../../components/common/SearchField';
import inputStyles from '../../components/common/inputs.module.css';
import { isSupabaseDataMode } from '../../config/dataMode';
import { AdminLayout, useAdminContext } from './AdminLayout';
import { useServices } from '../../hooks/useServices';
import styles from './AdminLayout.module.css';

function formatLastAccess(value: string | null): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function AdminUsersPage() {
  const context = useAdminContext();
  const { adminUserService } = useServices();
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('field_service');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('field_service');
  const supabaseMode = isSupabaseDataMode();

  const loadUsers = async () => {
    if (!context) {
      return;
    }
    const result = await adminUserService.getUsers(context, {
      query,
      status: statusFilter,
    });
    if (Array.isArray(result)) {
      setUsers(result);
    } else {
      setError('Keine Berechtigung für die Benutzerverwaltung.');
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [context, query, statusFilter]);

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (!context) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const result = await adminUserService.inviteUser(context, {
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
    });
    setSubmitting(false);
    if (result.ok) {
      setMessage(
        supabaseMode
          ? `${result.user.name} eingeladen. Eine E-Mail mit Link wurde gesendet.`
          : `${result.user.name} angelegt.`,
      );
      setShowInvite(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('field_service');
      await loadUsers();
    } else {
      setError(result.message ?? result.error);
    }
  };

  const handleSaveEdit = async (userId: string) => {
    if (!context) return;
    setError(null);
    const result = await adminUserService.updateUser(context, userId, {
      name: editName,
      role: editRole,
    });
    if (result.ok) {
      setMessage(`${result.user.name} aktualisiert`);
      setEditingId(null);
      await loadUsers();
    } else {
      setError(result.message ?? result.error);
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!context) return;
    const result = await adminUserService.deactivateUser(context, userId);
    if (result.ok) {
      setMessage(`${result.user.name} deaktiviert`);
      await loadUsers();
    } else {
      setError(result.message ?? result.error);
    }
  };

  const handleReactivate = async (userId: string) => {
    if (!context) return;
    const result = await adminUserService.reactivateUser(context, userId);
    if (result.ok) {
      setMessage(`${result.user.name} reaktiviert`);
      await loadUsers();
    } else {
      setError(result.message ?? result.error);
    }
  };

  const handleResend = async (userId: string) => {
    if (!context) return;
    const result = await adminUserService.resendInvite(context, userId);
    if (result.ok) {
      setMessage(`Einladung erneut gesendet an ${result.user.email}`);
      await loadUsers();
    } else {
      setError(result.message ?? result.error);
    }
  };

  const roleOptions: UserRole[] = [...ASSIGNABLE_USER_ROLES];

  return (
    <AdminLayout
      title="Benutzer"
      actions={
        <button type="button" onClick={() => setShowInvite((value) => !value)}>
          {showInvite ? 'Formular schließen' : 'Benutzer einladen'}
        </button>
      }
    >
      <div className={styles.toolbar}>
        <SearchField value={query} onChange={setQuery} placeholder="Name oder E-Mail suchen" />
        <FormField label="Status" id="admin-users-status">
          <select
            id="admin-users-status"
            className={inputStyles.select}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as UserStatus | 'all')}
            aria-label="Statusfilter"
          >
            <option value="all">Alle</option>
            <option value="invited">Eingeladen</option>
            <option value="active">Aktiv</option>
            <option value="deactivated">Deaktiviert</option>
          </select>
        </FormField>
      </div>

      {showInvite ? (
        <form className={styles.panel} onSubmit={(event) => void handleInvite(event)}>
          <div className={styles.formGrid}>
            <h2>Benutzer einladen</h2>
            <p>
              Der Benutzer erhält eine Einladungs-Mail. Das Passwort wird nicht durch den
              Administrator gesehen.
            </p>
            <label>
              Anzeigename
              <input
                value={inviteName}
                onChange={(event) => setInviteName(event.target.value)}
                required
                autoComplete="name"
              />
            </label>
            <label>
              E-Mail
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Rolle
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as UserRole)}
                aria-label="Rolle für Einladung"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {USER_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Einladung wird gesendet…' : 'Einladung senden'}
            </button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p role="status">{message}</p>
      ) : null}
      {error ? (
        <p role="alert">{error}</p>
      ) : null}

      {users.length === 0 ? (
        <EmptyState title="Keine Benutzer" description="Es wurden keine Benutzer gefunden." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Rolle</th>
                <th>Status</th>
                <th>Letzter Zugriff</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isEditing = editingId === user.id;
                return (
                  <tr key={user.id}>
                    <td>
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          aria-label={`Anzeigename für ${user.email}`}
                        />
                      ) : (
                        user.name
                      )}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(event) => setEditRole(event.target.value as UserRole)}
                          aria-label={`Rolle für ${user.name}`}
                        >
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {USER_ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        USER_ROLE_LABELS[user.role]
                      )}
                    </td>
                    <td>{USER_STATUS_LABELS[user.status]}</td>
                    <td>{formatLastAccess(user.lastAccessAt)}</td>
                    <td>
                      <div className={styles.subnav}>
                        {isEditing ? (
                          <>
                            <button type="button" onClick={() => void handleSaveEdit(user.id)}>
                              Speichern
                            </button>
                            <button type="button" onClick={() => setEditingId(null)}>
                              Abbrechen
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(user.id);
                              setEditName(user.name);
                              setEditRole(user.role);
                            }}
                          >
                            Bearbeiten
                          </button>
                        )}
                        {user.status === 'active' ? (
                          <button type="button" onClick={() => void handleDeactivate(user.id)}>
                            Deaktivieren
                          </button>
                        ) : null}
                        {user.status === 'deactivated' ? (
                          <button type="button" onClick={() => void handleReactivate(user.id)}>
                            Reaktivieren
                          </button>
                        ) : null}
                        {user.status === 'invited' && supabaseMode ? (
                          <button type="button" onClick={() => void handleResend(user.id)}>
                            Einladung erneut senden
                          </button>
                        ) : null}
                        {user.status === 'invited' && !supabaseMode ? (
                          <button type="button" onClick={() => void handleReactivate(user.id)}>
                            Aktivieren
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}

export function AdminRolesPage() {
  return (
    <AdminLayout title="Rollen">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rolle</th>
              <th>Beschreibung</th>
            </tr>
          </thead>
          <tbody>
            {ASSIGNABLE_USER_ROLES.map((role) => (
              <tr key={role}>
                <td>{USER_ROLE_LABELS[role]}</td>
                <td>{USER_ROLE_DESCRIPTIONS[role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
