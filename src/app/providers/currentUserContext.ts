import { createContext } from 'react';
import type { User } from '../../domain/user/user';

export interface CurrentUserContextValue {
  currentUser: User | null;
  isLoading: boolean;
  authError: string | null;
  switchUser: (userId: string) => Promise<User | null>;
  refresh: () => Promise<void>;
}

export const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);
