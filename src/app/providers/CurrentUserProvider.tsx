import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from '../../domain/user/user';
import { useServices } from '../../hooks/useServices';
import {
  CurrentUserContext,
  type CurrentUserContextValue,
} from './currentUserContext';

interface CurrentUserProviderProps {
  children: ReactNode;
}

export function CurrentUserProvider({ children }: CurrentUserProviderProps) {
  const { userService } = useServices();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const user = await userService.getCurrentUser();
      setCurrentUser(user);
      setAuthError(null);
    } catch (error) {
      setCurrentUser(null);
      setAuthError(error instanceof Error ? error.message : 'Benutzer konnte nicht geladen werden.');
    }
  }, [userService]);

  useEffect(() => {
    let active = true;

    void (async () => {
      setIsLoading(true);
      try {
        const user = await userService.getCurrentUser();
        if (active) {
          setCurrentUser(user);
          setAuthError(null);
          setIsLoading(false);
        }
      } catch (error) {
        if (active) {
          setCurrentUser(null);
          setAuthError(
            error instanceof Error ? error.message : 'Benutzer konnte nicht geladen werden.',
          );
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [userService]);

  const switchUser = useCallback(
    async (userId: string) => {
      const user = await userService.switchUser(userId);
      setCurrentUser(user);
      setAuthError(null);
      return user;
    },
    [userService],
  );

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      currentUser,
      isLoading,
      authError,
      switchUser,
      refresh,
    }),
    [currentUser, isLoading, authError, switchUser, refresh],
  );

  return (
    <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
  );
}
