import type { User } from '../../domain/user/user';

export interface UserRepository {
  getAll(): Promise<User[]>;
  getById(id: string): Promise<User | null>;
  getCurrentUser(): Promise<User | null>;
  setCurrentUser(id: string): Promise<User | null>;
}
