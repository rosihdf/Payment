import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadAppRuntimeConfig } from '../../config/appRuntimeConfig';
import { ASSIGNABLE_USER_ROLES, USER_ROLE_LABELS, type User } from '../../domain/user/user';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { FormControl } from '../common/FormControl';
import styles from './RoleSwitcher.module.css';

function sortDemoUsers(users: User[]): User[] {
  const preferredOrder = ['user_004', 'user_001'];
  return [...users].sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left.id);
    const rightIndex = preferredOrder.indexOf(right.id);
    if (leftIndex === -1 && rightIndex === -1) {
      return left.name.localeCompare(right.name, 'de');
    }
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

export function RoleSwitcher() {
  const config = loadAppRuntimeConfig();
  const { userService } = useServices();
  const { currentUser, switchUser } = useCurrentUser();
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    void userService.getAllUsers().then(setUsers);
  }, [userService]);

  const visibleUsers = sortDemoUsers(
    users.filter(
      (user) => user.status === 'active' && ASSIGNABLE_USER_ROLES.includes(user.role),
    ),
  );

  if (!config.demoMode) {
    return (
      <div className={styles.switcher}>
        <span className={styles.label}>Angemeldet</span>
        <span className={styles.demoHint}>
          {currentUser
            ? `${currentUser.name} (${USER_ROLE_LABELS[currentUser.role]})`
            : '—'}
        </span>
        <Link className={styles.profileLink} to="/profile">
          Profil
        </Link>
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
      <FormControl
        type="select"
        id="role-switcher"
        hideLabel
        className={styles.selectControl}
        value={currentUser?.id ?? ''}
        onChange={(event) => void handleChange(event)}
        aria-label="Demo-Benutzer wechseln"
      >
        {visibleUsers.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({USER_ROLE_LABELS[user.role]})
          </option>
        ))}
      </FormControl>
      <Link className={styles.profileLink} to="/profile">
        Profil
      </Link>
    </div>
  );
}
