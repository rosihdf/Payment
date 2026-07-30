import { useContext } from 'react';
import { CurrentUserContext } from '../app/providers/currentUserContext';

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error('useCurrentUser must be used within CurrentUserProvider');
  }

  return context;
}
