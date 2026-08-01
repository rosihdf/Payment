import { isSupabaseDataMode } from '../config/dataMode';
import type { AuditAction } from '../domain/audit/auditEntry';
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
import {
  deactivateUserViaApi,
  inviteUserViaApi,
  reactivateUserViaApi,
  resendInviteViaApi,
  updateUserViaApi,
} from './adminUserApiClient';
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

  private async auditFromRemote(
    context: UserContext,
    action: AuditAction,
    user: User,
    summary: string,
    changes?: { field: string; before: string | null; after: string | null }[],
  ): Promise<void> {
    await this.auditService.logChange({
      context,
      action,
      entityType: 'user',
      entityId: user.id,
      summary,
      changes,
    });
  }

  /** Lokaler Demo-Pfad: legt nur ein Profil-ähnliches Record an (kein Auth). */
  async createUser(
    context: UserContext,
    input: CreateUserInput,
  ): Promise<{ ok: true; user: User } | { ok: false; error: 'forbidden' | 'validation'; message?: string }> {
    if (isSupabaseDataMode()) {
      const invited = await this.inviteUser(context, input);
      if (!invited.ok) {
        return {
          ok: false,
          error: invited.error === 'forbidden' ? 'forbidden' : 'validation',
          message: invited.message,
        };
      }
      return invited;
    }

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

  async inviteUser(
    context: UserContext,
    input: CreateUserInput,
  ): Promise<
    | { ok: true; user: User }
    | { ok: false; error: string; message?: string }
  > {
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

    if (!isSupabaseDataMode()) {
      return this.createUser(context, input);
    }

    const result = await inviteUserViaApi({
      email,
      displayName: name,
      role: input.role,
    });
    if (!result.ok) {
      return { ok: false, error: result.error, message: result.message };
    }

    await this.auditFromRemote(
      context,
      'user_invited',
      result.user,
      `Benutzer ${result.user.name} eingeladen`,
      [{ field: 'role', before: null, after: result.user.role }],
    );
    return { ok: true, user: result.user };
  }

  async updateUser(
    context: UserContext,
    userId: string,
    input: UpdateUserInput,
  ): Promise<
    | { ok: true; user: User }
    | {
        ok: false;
        error: 'forbidden' | 'not_found' | 'protected' | 'validation' | string;
        message?: string;
      }
  > {
    const guard = requirePermission(context, 'admin.users');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    if (input.role !== undefined && !isAssignableUserRole(input.role)) {
      return { ok: false, error: 'validation', message: 'Nur Administrator oder Außendienst sind zulässig.' };
    }

    if (isSupabaseDataMode()) {
      if (input.email !== undefined) {
        return {
          ok: false,
          error: 'validation',
          message: 'E-Mail-Änderungen erfolgen nicht über die Benutzerverwaltung.',
        };
      }
      const result = await updateUserViaApi(userId, {
        displayName: input.name,
        role: input.role,
      });
      if (!result.ok) {
        return { ok: false, error: result.error, message: result.message };
      }
      const action: AuditAction =
        result.auditAction === 'role_changed' ? 'role_changed' : 'user_updated';
      await this.auditFromRemote(
        context,
        action,
        result.user,
        action === 'role_changed'
          ? `Rolle geändert: ${result.previousRole ?? '?'} → ${result.user.role}`
          : `Benutzer ${result.user.name} geändert`,
        action === 'role_changed'
          ? [{ field: 'role', before: result.previousRole ?? null, after: result.user.role }]
          : undefined,
      );
      return { ok: true, user: result.user };
    }

    const existing = await this.userRepository.getById(userId);
    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    if (input.role && input.role !== 'admin' && existing.role === 'admin') {
      const remainingAdmins = await this.countActiveAdmins(userId);
      if (remainingAdmins === 0) {
        return { ok: false, error: 'protected', message: 'Der letzte aktive Administrator kann nicht entzogen werden.' };
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
  ): Promise<
    | { ok: true; user: User }
    | { ok: false; error: 'forbidden' | 'not_found' | 'protected' | string; message?: string }
  > {
    const guard = requirePermission(context, 'admin.users');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    if (isSupabaseDataMode()) {
      const result = await deactivateUserViaApi(userId);
      if (!result.ok) {
        return { ok: false, error: result.error, message: result.message };
      }
      await this.auditFromRemote(
        context,
        'user_deactivated',
        result.user,
        `Benutzer ${result.user.name} deaktiviert`,
      );
      return { ok: true, user: result.user };
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
  ): Promise<
    | { ok: true; user: User }
    | { ok: false; error: 'forbidden' | 'not_found' | string; message?: string }
  > {
    const guard = requirePermission(context, 'admin.users');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    if (isSupabaseDataMode()) {
      const result = await reactivateUserViaApi(userId);
      if (!result.ok) {
        return { ok: false, error: result.error, message: result.message };
      }
      await this.auditFromRemote(
        context,
        'user_reactivated',
        result.user,
        `Benutzer ${result.user.name} reaktiviert`,
      );
      return { ok: true, user: result.user };
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

  async resendInvite(
    context: UserContext,
    userId: string,
  ): Promise<
    | { ok: true; user: User }
    | { ok: false; error: string; message?: string }
  > {
    const guard = requirePermission(context, 'admin.users');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    if (!isSupabaseDataMode()) {
      return {
        ok: false,
        error: 'validation',
        message: 'Einladungen sind nur im Supabase-Modus verfügbar.',
      };
    }

    const result = await resendInviteViaApi(userId);
    if (!result.ok) {
      return { ok: false, error: result.error, message: result.message };
    }

    await this.auditFromRemote(
      context,
      'user_invite_resent',
      result.user,
      `Einladung erneut gesendet: ${result.user.email}`,
    );
    return { ok: true, user: result.user };
  }
}

export function assertCanMutate(context: UserContext, permission: Permission): void {
  const guard = requirePermission(context, permission);
  if (!guard.ok) {
    throw new Error(guard.error);
  }
}
