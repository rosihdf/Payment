import type { User, UserRole } from '../domain/user/user';
import type { UserRepository } from '../repositories/interfaces/UserRepository';

export class UserService {
  private readonly userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.getAll();
  }

  async getCurrentUser(): Promise<User | null> {
    return this.userRepository.getCurrentUser();
  }

  async switchUser(userId: string): Promise<User | null> {
    return this.userRepository.setCurrentUser(userId);
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    const users = await this.userRepository.getAll();
    return users.filter((user) => user.role === role);
  }
}
