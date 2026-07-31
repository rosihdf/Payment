import { useEffect, useState } from 'react';
import {
  ASSIGNABLE_USER_ROLES,
  USER_ROLE_DESCRIPTIONS,
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  type User,
  type UserRole,
} from '../../domain/user/user';
import { EmptyState } from '../../components/feedback/EmptyState';
import { SearchField } from '../../components/common/SearchField';
import { AdminLayout, useAdminContext } from './AdminLayout';
import { useServices } from '../../hooks/useServices';
import styles from './AdminLayout.module.css';

export function AdminUsersPage() {
  const context = useAdminContext();
  const { adminUserService } = useServices();
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!context) {
      return;
    }
    const result = await adminUserService.getUsers(context, { query });
    if (Array.isArray(result)) {
      setUsers(result);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [context, query]);

  const handleDeactivate = async (userId: string) => {
    if (!context) {
      return;
    }
    const result = await adminUserService.deactivateUser(context, userId);
    if (result.ok) {
      setMessage(`${result.user.name} deaktiviert`);
      await loadUsers();
    } else {
      setMessage(result.message ?? result.error);
    }
  };

  const handleReactivate = async (userId: string) => {
    if (!context) {
      return;
    }
    const result = await adminUserService.reactivateUser(context, userId);
    if (result.ok) {
      setMessage(`${result.user.name} reaktiviert`);
      await loadUsers();
    }
  };

  const handleCreate = async () => {
    if (!context) {
      return;
    }
    const result = await adminUserService.createUser(context, {
      name: 'Neuer Demo-Benutzer',
      email: `demo-${Date.now()}@demo.local`,
      role: 'field_service',
    });
    if (result.ok) {
      setMessage(`${result.user.name} angelegt`);
      await loadUsers();
    }
  };

  const handleRoleChange = async (user: User, role: UserRole) => {
    if (!context || user.role === role) {
      return;
    }
    const result = await adminUserService.updateUser(context, user.id, { role });
    if (result.ok) {
      setMessage(`${result.user.name}: Rolle auf ${USER_ROLE_LABELS[role]} geändert`);
      await loadUsers();
    } else {
      setMessage(result.message ?? result.error);
    }
  };

  const roleOptions: UserRole[] = [...ASSIGNABLE_USER_ROLES];

  return (
    <AdminLayout
      title="Benutzer"
      actions={
        <button type="button" onClick={() => void handleCreate()}>
          Benutzer anlegen
        </button>
      }
    >
      <div className={styles.toolbar}>
        <SearchField value={query} onChange={setQuery} placeholder="Name oder E-Mail suchen" />
      </div>
      {message ? <p role="status">{message}</p> : null}
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
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      id={`role-${user.id}`}
                      aria-label={`Rolle für ${user.name}`}
                      value={user.role}
                      disabled={user.status !== 'active'}
                      onChange={(event) => void handleRoleChange(user, event.target.value as UserRole)}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {USER_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{USER_STATUS_LABELS[user.status]}</td>
                  <td>
                    {user.status === 'active' ? (
                      <button type="button" onClick={() => void handleDeactivate(user.id)}>
                        Deaktivieren
                      </button>
                    ) : (
                      <button type="button" onClick={() => void handleReactivate(user.id)}>
                        Reaktivieren
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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
