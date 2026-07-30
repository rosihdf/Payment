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

  const refresh = useCallback(async () => {
    const user = await userService.getCurrentUser();
    setCurrentUser(user);
  }, [userService]);

  useEffect(() => {
    let active = true;

    void (async () => {
      setIsLoading(true);
      const user = await userService.getCurrentUser();
      if (active) {
        setCurrentUser(user);
        setIsLoading(false);
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
      return user;
    },
    [userService],
  );

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      currentUser,
      isLoading,
      switchUser,
      refresh,
    }),
    [currentUser, isLoading, switchUser, refresh],
  );

  return (
    <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
  );
}
