import { useEffect, useState } from 'react';
import { loadAppRuntimeConfig } from '../../config/appRuntimeConfig';
import { USER_ROLE_LABELS } from '../../domain/user/user';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import styles from './RoleSwitcher.module.css';

export function RoleSwitcher() {
  const config = loadAppRuntimeConfig();
  const { userService } = useServices();
  const { currentUser, switchUser } = useCurrentUser();
  const { showToast } = useToast();
  const [users, setUsers] = useState<Awaited<ReturnType<typeof userService.getAllUsers>>>([]);

  useEffect(() => {
    void userService.getAllUsers().then(setUsers);
  }, [userService]);

  if (!config.demoMode) {
    return (
      <div className={styles.switcher}>
        <span className={styles.label}>Benutzer</span>
        <span className={styles.demoHint}>{currentUser?.name ?? '—'}</span>
      </div>
    );
  }

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const user = await switchUser(event.target.value);
    if (user) {
      showToast(`Demo-Benutzer: ${user.name} (${USER_ROLE_LABELS[user.role]})`, 'success');
    }
  };

  return (
    <div className={styles.switcher}>
      <label className={styles.label} htmlFor="role-switcher">
        Demo-Benutzer
      </label>
      <select
        id="role-switcher"
        className={styles.select}
        value={currentUser?.id ?? ''}
        onChange={(event) => void handleChange(event)}
        aria-label="Demo-Benutzer wechseln"
      >
        {users
          .filter((user) => user.status === 'active')
          .map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({USER_ROLE_LABELS[user.role]})
            </option>
          ))}
      </select>
    </div>
  );
}
