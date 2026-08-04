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
import { isSupabaseDataMode } from '../../config/dataMode';
import { AdminLayout, useAdminContext } from '../../features/admin/AdminLayout';
import { useServices } from '../../hooks/useServices';
import { Button } from '../ui/Button';
import { DataList, DataListCard } from '../ui/DataList';
import { FormField } from '../ui/FormField';
import { ResponsiveTable, type ResponsiveTableColumn } from '../ui/ResponsiveTable';
import { StatusBadge, type StatusBadgeVariant } from '../ui/StatusBadge';
import styles from '../../features/admin/AdminLayout.module.css';

const USER_STATUS_BADGE_VARIANT: Record<UserStatus, StatusBadgeVariant> = {
  active: 'success',
  invited: 'warning',
  deactivated: 'neutral',
};

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

  const columns: ResponsiveTableColumn<User>[] = [
    {
      id: 'name',
      header: 'Name',
      render: (user) =>
        editingId === user.id ? (
          <FormField
            type="text"
            hideLabel
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            aria-label={`Anzeigename für ${user.email}`}
          />
        ) : (
          user.name
        ),
    },
    { id: 'email', header: 'E-Mail', render: (user) => user.email },
    {
      id: 'role',
      header: 'Rolle',
      render: (user) =>
        editingId === user.id ? (
          <FormField
            type="select"
            hideLabel
            value={editRole}
            onChange={(event) => setEditRole(event.target.value as UserRole)}
            aria-label={`Rolle für ${user.name}`}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {USER_ROLE_LABELS[role]}
              </option>
            ))}
          </FormField>
        ) : (
          USER_ROLE_LABELS[user.role]
        ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (user) => (
        <StatusBadge variant={USER_STATUS_BADGE_VARIANT[user.status]} label={USER_STATUS_LABELS[user.status]} />
      ),
    },
    { id: 'lastAccess', header: 'Letzter Zugriff', render: (user) => formatLastAccess(user.lastAccessAt) },
  ];

  return (
    <AdminLayout
      title="Benutzer"
      actions={
        <Button type="button" onClick={() => setShowInvite((value) => !value)}>
          {showInvite ? 'Formular schließen' : 'Benutzer einladen'}
        </Button>
      }
    >
      <div className={styles.toolbar}>
        <FormField
          type="search"
          label="Suche"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name oder E-Mail suchen"
        />
        <FormField
          type="select"
          id="admin-users-status"
          label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as UserStatus | 'all')}
          aria-label="Statusfilter"
        >
          <option value="all">Alle</option>
          <option value="invited">Eingeladen</option>
          <option value="active">Aktiv</option>
          <option value="deactivated">Deaktiviert</option>
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
            <FormField
              id="invite-name"
              type="text"
              label="Anzeigename"
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              required
              autoComplete="name"
            />
            <FormField
              id="invite-email"
              type="email"
              label="E-Mail"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              required
              autoComplete="email"
            />
            <FormField
              type="select"
              label="Rolle"
              id="admin-invite-role"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as UserRole)}
              aria-label="Rolle für Einladung"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {USER_ROLE_LABELS[role]}
                </option>
              ))}
            </FormField>
            <Button type="submit" disabled={submitting} loading={submitting}>
              {submitting ? 'Einladung wird gesendet…' : 'Einladung senden'}
            </Button>
            {error && showInvite ? <p role="alert">{error}</p> : null}
          </div>
        </form>
      ) : null}

      {message ? <p role="status">{message}</p> : null}
      {error && !showInvite ? <p role="alert">{error}</p> : null}

      {users.length === 0 ? (
        <EmptyState title="Keine Benutzer" description="Es wurden keine Benutzer gefunden." />
      ) : (
        <ResponsiveTable
          ariaLabel="Benutzerliste"
          columns={columns}
          rows={users}
          rowKey={(user) => user.id}
          actionsColumnLabel="Aktionen"
          renderActions={(user) => {
            const isEditing = editingId === user.id;
            return (
              <div className={styles.toolbar}>
                {isEditing ? (
                  <>
                    <Button size="compact" type="button" onClick={() => void handleSaveEdit(user.id)}>
                      Speichern
                    </Button>
                    <Button size="compact" type="button" variant="secondary" onClick={() => setEditingId(null)}>
                      Abbrechen
                    </Button>
                  </>
                ) : (
                  <Button
                    size="compact"
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(user.id);
                      setEditName(user.name);
                      setEditRole(user.role);
                    }}
                  >
                    Bearbeiten
                  </Button>
                )}
                {user.status === 'active' ? (
                  <Button size="compact" type="button" variant="secondary" onClick={() => void handleDeactivate(user.id)}>
                    Deaktivieren
                  </Button>
                ) : null}
                {user.status === 'deactivated' ? (
                  <Button size="compact" type="button" variant="secondary" onClick={() => void handleReactivate(user.id)}>
                    Reaktivieren
                  </Button>
                ) : null}
                {user.status === 'invited' && supabaseMode ? (
                  <Button size="compact" type="button" variant="secondary" onClick={() => void handleResend(user.id)}>
                    Einladung erneut senden
                  </Button>
                ) : null}
                {user.status === 'invited' && !supabaseMode ? (
                  <Button size="compact" type="button" variant="secondary" onClick={() => void handleReactivate(user.id)}>
                    Aktivieren
                  </Button>
                ) : null}
              </div>
            );
          }}
        />
      )}
    </AdminLayout>
  );
}

export function AdminRolesPage() {
  return (
    <AdminLayout title="Rollen">
      <DataList
        items={[...ASSIGNABLE_USER_ROLES]}
        getKey={(role) => role}
        aria-label="Rollenliste"
        renderItem={(role) => (
          <DataListCard title={USER_ROLE_LABELS[role]} meta={USER_ROLE_DESCRIPTIONS[role]} />
        )}
      />
    </AdminLayout>
  );
}
