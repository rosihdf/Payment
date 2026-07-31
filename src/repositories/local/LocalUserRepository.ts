import { normalizeUsers } from '../../domain/user/normalizeUser';
import type { User } from '../../domain/user/user';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { UserRepository } from '../interfaces/UserRepository';

export class LocalUserRepository implements UserRepository {
  async getAll(): Promise<User[]> {
    return normalizeUsers(readStorageItem<unknown[]>(STORAGE_KEYS.users));
  }

  async getById(id: string): Promise<User | null> {
    const users = await this.getAll();
    return users.find((user) => user.id === id) ?? null;
  }

  async getCurrentUser(): Promise<User | null> {
    const currentUserId = readStorageItem<string>(STORAGE_KEYS.currentUserId);
    if (!currentUserId) {
      return null;
    }

    return this.getById(currentUserId);
  }

  async setCurrentUser(id: string): Promise<User | null> {
    const user = await this.getById(id);
    if (!user || user.status !== 'active') {
      return null;
    }

    writeStorageItem(STORAGE_KEYS.currentUserId, id);
    return user;
  }

  async save(user: User): Promise<User> {
    const users = await this.getAll();
    const index = users.findIndex((entry) => entry.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    writeStorageItem(STORAGE_KEYS.users, users);
    return user;
  }

  async saveAll(users: User[]): Promise<User[]> {
    writeStorageItem(STORAGE_KEYS.users, users);
    return users;
  }
}
