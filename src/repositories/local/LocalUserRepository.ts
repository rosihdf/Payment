import type { User } from '../../domain/user/user';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { UserRepository } from '../interfaces/UserRepository';

export class LocalUserRepository implements UserRepository {
  async getAll(): Promise<User[]> {
    return readStorageItem<User[]>(STORAGE_KEYS.users) ?? [];
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
    if (!user) {
      return null;
    }

    writeStorageItem(STORAGE_KEYS.currentUserId, id);
    return user;
  }
}
