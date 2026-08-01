import { getSupabaseClient } from '../lib/supabaseClient';
import type { User, UserRole } from '../domain/user/user';
import { profileRowToUser, type ProfileRow } from '../repositories/supabase/mapProfile';

export type AdminUserApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'duplicate'
  | 'not_found'
  | 'protected'
  | 'invite_failed'
  | 'profile_failed'
  | 'already_deactivated'
  | 'already_active'
  | 'invite_pending'
  | 'invite_not_relevant'
  | 'rate_limited'
  | 'misconfigured'
  | 'update_failed'
  | 'network'
  | 'unknown';

export interface AdminUserApiResult {
  ok: true;
  user: User;
  auditAction?: string;
  previousRole?: string;
}

export interface AdminUserApiFailure {
  ok: false;
  error: AdminUserApiErrorCode;
  message: string;
}

async function authHeader(): Promise<string> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    throw Object.assign(new Error('Sitzung ungültig oder abgelaufen.'), {
      code: 'unauthorized' as const,
    });
  }
  return `Bearer ${data.session.access_token}`;
}

async function callApi(
  path: string,
  init: RequestInit,
): Promise<AdminUserApiResult | AdminUserApiFailure> {
  let response: Response;
  try {
    const authorization = await authHeader();
    response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
        ...(init.headers ?? {}),
      },
    });
  } catch {
    return {
      ok: false,
      error: 'network',
      message: 'Netzwerkfehler. Bitte Verbindung prüfen.',
    };
  }

  let payload: {
    ok?: boolean;
    error?: string;
    message?: string;
    user?: ProfileRow;
    auditAction?: string;
    previousRole?: string;
  } = {};

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return {
      ok: false,
      error: 'unknown',
      message: 'Unerwartete Serverantwort.',
    };
  }

  if (!response.ok || !payload.ok || !payload.user) {
    return {
      ok: false,
      error: (payload.error as AdminUserApiErrorCode) ?? 'unknown',
      message: payload.message ?? 'Aktion fehlgeschlagen.',
    };
  }

  return {
    ok: true,
    user: profileRowToUser(payload.user),
    auditAction: payload.auditAction,
    previousRole: payload.previousRole,
  };
}

export async function inviteUserViaApi(input: {
  email: string;
  displayName: string;
  role: UserRole;
}): Promise<AdminUserApiResult | AdminUserApiFailure> {
  return callApi('/api/admin/users/invite', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      displayName: input.displayName,
      role: input.role,
    }),
  });
}

export async function updateUserViaApi(
  userId: string,
  input: { displayName?: string; role?: UserRole },
): Promise<AdminUserApiResult | AdminUserApiFailure> {
  return callApi(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deactivateUserViaApi(
  userId: string,
): Promise<AdminUserApiResult | AdminUserApiFailure> {
  return callApi(`/api/admin/users/${encodeURIComponent(userId)}/deactivate`, {
    method: 'POST',
    body: '{}',
  });
}

export async function reactivateUserViaApi(
  userId: string,
): Promise<AdminUserApiResult | AdminUserApiFailure> {
  return callApi(`/api/admin/users/${encodeURIComponent(userId)}/reactivate`, {
    method: 'POST',
    body: '{}',
  });
}

export async function resendInviteViaApi(
  userId: string,
): Promise<AdminUserApiResult | AdminUserApiFailure> {
  return callApi(`/api/admin/users/${encodeURIComponent(userId)}/resend-invite`, {
    method: 'POST',
    body: '{}',
  });
}
