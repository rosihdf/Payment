import type { Permission } from '../domain/permission/permission';
import { hasPermission } from '../domain/permission/permission';
import { CURRENT_USER_SCHEMA_VERSION } from '../domain/user/normalizeUser';
import {
  isAssignableUserRole,
  type User,
  type UserContext,
  type UserRole,
  type UserStatus,
} from '../domain/user/user';
import { generateId, nowIso } from '../utils/id';
import type { UserRepository } from '../repositories/interfaces/UserRepository';
import type { AuditService } from './auditService';
import { requirePermission } from './auditService';

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
}

export interface UserFilter {
  query?: string;
  role?: UserRole | 'all';
  status?: UserStatus | 'all';
}

export class AdminUserService {
  private readonly userRepository: UserRepository;
  private readonly auditService: AuditService;

  constructor(userRepository: UserRepository, auditService: AuditService) {
    this.userRepository = userRepository;
    this.auditService = auditService;
  }

  canManageUsers(context: UserContext): boolean {
    return hasPermission(context.role, 'admin.users') && context.status === 'active';
  }

  filterUsers(users: User[], filter: UserFilter): User[] {
    return users.filter((user) => {
      if (filter.role && filter.role !== 'all' && user.role !== filter.role) {
        return false;
      }
      if (filter.status && filter.status !== 'all' && user.status !== filter.status) {
        return false;
      }
      if (filter.query) {
        const query = filter.query.toLowerCase();
        const haystack = `${user.name} ${user.email}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }

  async getUsers(context: UserContext, filter: UserFilter = {}): Promise<User[] | { error: 'forbidden' }> {
    const guard = requirePermission(context, 'admin.users');
    if (!guard.ok) {
      return { error: 'forbidden' };
    }
    const users = await this.userRepository.getAll();
    return this.filterUsers(users, filter);
  }

  private async countActiveAdmins(excludeUserId?: string): Promise<number> {
    const users = await this.userRepository.getAll();
    return users.filter(
      (user) => user.role === 'admin' && user.status === 'active' && user.id !== excludeUserId,
    ).length;
  }

  async createUser(
    context: UserContext,
    input: CreateUserInput,
  ): Promise<{ ok: true; user: User } | { ok: false; error: 'forbidden' | 'validation'; message?: string }> {
    const guard = requirePermission(context, 'admin.users');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const name = input.name.trim();
    const email = input.email.trim();
    if (!name || !email.includes('@')) {
      return { ok: false, error: 'validation', message: 'Name und gültige E-Mail sind erforderlich.' };
    }
    if (!isAssignableUserRole(input.role)) {
      return { ok: false, error: 'validation', message: 'Nur Administrator oder Außendienst sind zulässig.' };
    }

    const timestamp = nowIso();
    const user: User = {
      id: generateId('user'),
      name,
      email,
      role: input.role,
      status: 'invited',
      salesTeamId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deactivatedAt: null,
      lastAccessAt: null,
      schemaVersion: CURRENT_USER_SCHEMA_VERSION,
    };

    await this.userRepository.save(user);
    await this.auditService.logChange({
      context,
      action: 'user_created',
      entityType: 'user',
      entityId: user.id,
      summary: `Benutzer ${user.name} angelegt`,
      changes: [{ field: 'role', before: null, after: user.role }],
    });

    return { ok: true, user };
  }

  async updateUser(
    context: UserContext,
    userId: string,
    input: UpdateUserInput,
  ): Promise<{ ok: true; user: User } | { ok: false; error: 'forbidden' | 'not_found' | 'protected' | 'validation'; message?: string }> {
    const guard = requirePermission(context, 'admin.users');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const existing = await this.userRepository.getById(userId);
    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    if (input.role !== undefined && !isAssignableUserRole(input.role)) {
      return { ok: false, error: 'validation', message: 'Nur Administrator oder Außendienst sind zulässig.' };
    }

    if (input.role && input.role !== 'admin' && existing.role === 'admin') {
      const remainingAdmins = await this.countActiveAdmins(userId);
      if (remainingAdmins === 0) {
        return { ok: false, error: 'protected', message: 'Der letzte aktive Administrator kann nicht entzogen werden.' };
      }
    }

    if (context.userId === userId && input.role && input.role !== 'admin' && existing.role === 'admin') {
      const remainingAdmins = await this.countActiveAdmins(userId);
      if (remainingAdmins === 0) {
        return { ok: false, error: 'protected', message: 'Sie können sich nicht das letzte Adminrecht entziehen.' };
      }
    }

    const updated: User = {
      ...existing,
      name: input.name?.trim() || existing.name,
      email: input.email?.trim() || existing.email,
      role: input.role ?? existing.role,
      updatedAt: nowIso(),
    };

    await this.userRepository.save(updated);

    if (input.role && input.role !== existing.role) {
      await this.auditService.logChange({
        context,
        action: 'role_changed',
        entityType: 'user',
        entityId: updated.id,
        summary: `Rolle geändert: ${existing.role} → ${updated.role}`,
        changes: [{ field: 'role', before: existing.role, after: updated.role }],
      });
    } else {
      await this.auditService.logChange({
        context,
        action: 'user_updated',
        entityType: 'user',
        entityId: updated.id,
        summary: `Benutzer ${updated.name} geändert`,
      });
    }

    return { ok: true, user: updated };
  }

  async deactivateUser(
    context: UserContext,
    userId: string,
  ): Promise<{ ok: true; user: User } | { ok: false; error: 'forbidden' | 'not_found' | 'protected'; message?: string }> {
    const guard = requirePermission(context, 'admin.users');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const existing = await this.userRepository.getById(userId);
    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    if (existing.role === 'admin' && existing.status === 'active') {
      const remainingAdmins = await this.countActiveAdmins(userId);
      if (remainingAdmins === 0) {
        return { ok: false, error: 'protected', message: 'Der letzte aktive Administrator kann nicht deaktiviert werden.' };
      }
    }

    const timestamp = nowIso();
    const updated: User = {
      ...existing,
      status: 'deactivated',
      deactivatedAt: timestamp,
      updatedAt: timestamp,
    };

    await this.userRepository.save(updated);
    await this.auditService.logChange({
      context,
      action: 'user_deactivated',
      entityType: 'user',
      entityId: updated.id,
      summary: `Benutzer ${updated.name} deaktiviert`,
    });

    return { ok: true, user: updated };
  }

  async reactivateUser(
    context: UserContext,
    userId: string,
  ): Promise<{ ok: true; user: User } | { ok: false; error: 'forbidden' | 'not_found' }> {
    const guard = requirePermission(context, 'admin.users');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const existing = await this.userRepository.getById(userId);
    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    const updated: User = {
      ...existing,
      status: 'active',
      deactivatedAt: null,
      updatedAt: nowIso(),
    };

    await this.userRepository.save(updated);
    await this.auditService.logChange({
      context,
      action: 'user_reactivated',
      entityType: 'user',
      entityId: updated.id,
      summary: `Benutzer ${updated.name} reaktiviert`,
    });

    return { ok: true, user: updated };
  }
}

export function assertCanMutate(context: UserContext, permission: Permission): void {
  const guard = requirePermission(context, permission);
  if (!guard.ok) {
    throw new Error(guard.error);
  }
}
