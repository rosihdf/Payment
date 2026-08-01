import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface AdminEnv {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export type AssignableRole = 'admin' | 'field_service';

const APP_ORIGIN = 'https://amrtech-payment.amrtech.workers.dev';
const INVITE_REDIRECT = `${APP_ORIGIN}/auth/callback`;
const SCHEMA_VERSION = 3;

export interface JsonError {
  ok: false;
  error: string;
  message: string;
}

export interface ProfileRow {
  user_id: string;
  display_name: string;
  email: string;
  role: AssignableRole;
  status: 'active' | 'deactivated' | 'invited';
  sales_team_id: string | null;
  schema_version: number;
  deactivated_at: string | null;
  last_access_at: string | null;
  created_at: string;
  updated_at: string;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function errorResponse(
  status: number,
  error: string,
  message: string,
): Response {
  return jsonResponse({ ok: false, error, message } satisfies JsonError, status);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isAssignableRole(value: unknown): value is AssignableRole {
  return value === 'admin' || value === 'field_service';
}

function createServiceClient(env: AdminEnv): SupabaseClient {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error('SERVICE_ROLE_MISSING');
  }
  return createClient(env.SUPABASE_URL.replace(/\/$/, ''), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAdmin(
  request: Request,
  env: AdminEnv,
): Promise<
  | { ok: true; admin: ProfileRow; service: SupabaseClient }
  | { ok: false; response: Response }
> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return {
      ok: false,
      response: errorResponse(
        503,
        'misconfigured',
        'Benutzerverwaltung ist noch nicht vollständig konfiguriert.',
      ),
    };
  }

  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return {
      ok: false,
      response: errorResponse(401, 'unauthorized', 'Anmeldung erforderlich.'),
    };
  }

  const token = match[1]?.trim();
  if (!token) {
    return {
      ok: false,
      response: errorResponse(401, 'unauthorized', 'Anmeldung erforderlich.'),
    };
  }
  let service: SupabaseClient;
  try {
    service = createServiceClient(env);
  } catch {
    return {
      ok: false,
      response: errorResponse(
        503,
        'misconfigured',
        'Benutzerverwaltung ist noch nicht vollständig konfiguriert.',
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await service.auth.getUser(token);

  if (authError || !user) {
    return {
      ok: false,
      response: errorResponse(401, 'unauthorized', 'Sitzung ungültig oder abgelaufen.'),
    };
  }

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      response: errorResponse(403, 'forbidden', 'Kein gültiges Profil für diese Aktion.'),
    };
  }

  const admin = profile as ProfileRow;
  if (admin.status !== 'active' || admin.role !== 'admin') {
    return {
      ok: false,
      response: errorResponse(403, 'forbidden', 'Nur aktive Administratoren dürfen Benutzer verwalten.'),
    };
  }

  return { ok: true, admin, service };
}

async function countActiveAdmins(
  service: SupabaseClient,
  excludeUserId?: string,
): Promise<number> {
  const { data, error } = await service
    .from('profiles')
    .select('user_id, role, status');
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).filter(
    (row) =>
      row.role === 'admin' &&
      row.status === 'active' &&
      row.user_id !== excludeUserId,
  ).length;
}

async function getProfile(
  service: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await service
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as ProfileRow | null) ?? null;
}

function mapAuthError(message: string): { error: string; message: string; status: number } {
  const lower = message.toLowerCase();
  if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) {
    return {
      status: 409,
      error: 'duplicate',
      message: 'Diese E-Mail-Adresse ist bereits registriert.',
    };
  }
  if (lower.includes('rate') || lower.includes('limit')) {
    return {
      status: 429,
      error: 'rate_limited',
      message: 'Zu viele Einladungen. Bitte später erneut versuchen.',
    };
  }
  if (lower.includes('email')) {
    return {
      status: 400,
      error: 'validation',
      message: 'Die E-Mail-Adresse ist ungültig oder kann nicht eingeladen werden.',
    };
  }
  return {
    status: 400,
    error: 'invite_failed',
    message: 'Einladung fehlgeschlagen. Bitte Eingaben prüfen und erneut versuchen.',
  };
}

export async function handleInviteUser(request: Request, env: AdminEnv): Promise<Response> {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.response;

  let body: { email?: string; displayName?: string; role?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return errorResponse(400, 'validation', 'Ungültige Anfrage.');
  }

  const email = normalizeEmail(body.email ?? '');
  const displayName = (body.displayName ?? '').trim();
  const role = body.role;

  if (!email.includes('@') || !displayName) {
    return errorResponse(400, 'validation', 'Name und gültige E-Mail sind erforderlich.');
  }
  if (!isAssignableRole(role)) {
    return errorResponse(400, 'validation', 'Nur Administrator oder Außendienst sind zulässig.');
  }

  const { data: existingProfile } = await gate.service
    .from('profiles')
    .select('user_id')
    .eq('email', email)
    .maybeSingle();
  if (existingProfile) {
    return errorResponse(409, 'duplicate', 'Diese E-Mail-Adresse ist bereits registriert.');
  }

  const { data: invited, error: inviteError } = await gate.service.auth.admin.inviteUserByEmail(
    email,
    {
      data: { display_name: displayName, role },
      redirectTo: INVITE_REDIRECT,
    },
  );

  if (inviteError || !invited.user) {
    const mapped = mapAuthError(inviteError?.message ?? 'invite failed');
    return errorResponse(mapped.status, mapped.error, mapped.message);
  }

  const userId = invited.user.id;
  const now = new Date().toISOString();
  const profile: ProfileRow = {
    user_id: userId,
    display_name: displayName,
    email,
    role,
    status: 'invited',
    sales_team_id: null,
    schema_version: SCHEMA_VERSION,
    deactivated_at: null,
    last_access_at: null,
    created_at: now,
    updated_at: now,
  };

  const { data: inserted, error: insertError } = await gate.service
    .from('profiles')
    .insert(profile)
    .select('*')
    .single();

  if (insertError || !inserted) {
    await gate.service.auth.admin.deleteUser(userId);
    return errorResponse(
      500,
      'profile_failed',
      'Profil konnte nicht angelegt werden. Die Einladung wurde zurückgenommen.',
    );
  }

  return jsonResponse({
    ok: true,
    user: inserted,
    auditAction: 'user_invited',
  });
}

export async function handleUpdateUser(
  request: Request,
  env: AdminEnv,
  userId: string,
): Promise<Response> {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.response;

  let body: { displayName?: string; role?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return errorResponse(400, 'validation', 'Ungültige Anfrage.');
  }

  const existing = await getProfile(gate.service, userId);
  if (!existing) {
    return errorResponse(404, 'not_found', 'Benutzer wurde nicht gefunden.');
  }

  const displayName =
    body.displayName !== undefined ? body.displayName.trim() : existing.display_name;
  if (!displayName) {
    return errorResponse(400, 'validation', 'Anzeigename ist erforderlich.');
  }

  let nextRole = existing.role;
  if (body.role !== undefined) {
    if (!isAssignableRole(body.role)) {
      return errorResponse(400, 'validation', 'Nur Administrator oder Außendienst sind zulässig.');
    }
    nextRole = body.role;
  }

  if (existing.role === 'admin' && nextRole !== 'admin' && existing.status === 'active') {
    const remaining = await countActiveAdmins(gate.service, userId);
    if (remaining === 0) {
      return errorResponse(
        409,
        'protected',
        'Der letzte aktive Administrator kann nicht entzogen werden.',
      );
    }
  }

  const { data: updated, error } = await gate.service
    .from('profiles')
    .update({
      display_name: displayName,
      role: nextRole,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !updated) {
    return errorResponse(500, 'update_failed', 'Benutzer konnte nicht aktualisiert werden.');
  }

  return jsonResponse({
    ok: true,
    user: updated,
    auditAction: nextRole !== existing.role ? 'role_changed' : 'user_updated',
    previousRole: existing.role,
  });
}

export async function handleDeactivateUser(
  request: Request,
  env: AdminEnv,
  userId: string,
): Promise<Response> {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.response;

  const existing = await getProfile(gate.service, userId);
  if (!existing) {
    return errorResponse(404, 'not_found', 'Benutzer wurde nicht gefunden.');
  }
  if (existing.status === 'deactivated') {
    return errorResponse(409, 'already_deactivated', 'Benutzer ist bereits deaktiviert.');
  }

  if (existing.role === 'admin' && existing.status === 'active') {
    const remaining = await countActiveAdmins(gate.service, userId);
    if (remaining === 0) {
      return errorResponse(
        409,
        'protected',
        'Der letzte aktive Administrator kann nicht deaktiviert werden.',
      );
    }
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await gate.service
    .from('profiles')
    .update({
      status: 'deactivated',
      deactivated_at: now,
      updated_at: now,
    })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !updated) {
    return errorResponse(500, 'update_failed', 'Benutzer konnte nicht deaktiviert werden.');
  }

  const { error: banError } = await gate.service.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  });
  if (banError) {
    // Profil ist deaktiviert – Auth-Sperre best effort
    console.error('auth ban failed', banError.message);
  }

  return jsonResponse({
    ok: true,
    user: updated,
    auditAction: 'user_deactivated',
  });
}

export async function handleReactivateUser(
  request: Request,
  env: AdminEnv,
  userId: string,
): Promise<Response> {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.response;

  const existing = await getProfile(gate.service, userId);
  if (!existing) {
    return errorResponse(404, 'not_found', 'Benutzer wurde nicht gefunden.');
  }
  if (existing.status === 'invited') {
    return errorResponse(
      409,
      'invite_pending',
      'Eingeladene Benutzer bitte über „Einladung erneut senden“ fortsetzen.',
    );
  }
  if (existing.status === 'active') {
    return errorResponse(409, 'already_active', 'Benutzer ist bereits aktiv.');
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await gate.service
    .from('profiles')
    .update({
      status: 'active',
      deactivated_at: null,
      updated_at: now,
    })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !updated) {
    return errorResponse(500, 'update_failed', 'Benutzer konnte nicht reaktiviert werden.');
  }

  const { error: unbanError } = await gate.service.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  });
  if (unbanError) {
    console.error('auth unban failed', unbanError.message);
  }

  return jsonResponse({
    ok: true,
    user: updated,
    auditAction: 'user_reactivated',
  });
}

export async function handleResendInvite(
  request: Request,
  env: AdminEnv,
  userId: string,
): Promise<Response> {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.response;

  const existing = await getProfile(gate.service, userId);
  if (!existing) {
    return errorResponse(404, 'not_found', 'Benutzer wurde nicht gefunden.');
  }
  if (existing.status !== 'invited') {
    return errorResponse(
      409,
      'invite_not_relevant',
      'Einladung ist für diesen Benutzerstatus nicht mehr relevant.',
    );
  }

  const { error } = await gate.service.auth.admin.inviteUserByEmail(existing.email, {
    data: { display_name: existing.display_name, role: existing.role },
    redirectTo: INVITE_REDIRECT,
  });

  if (error) {
    const mapped = mapAuthError(error.message);
    return errorResponse(mapped.status, mapped.error, mapped.message);
  }

  await gate.service
    .from('profiles')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return jsonResponse({
    ok: true,
    user: existing,
    auditAction: 'user_invite_resent',
  });
}

export async function routeAdminUsersApi(
  request: Request,
  env: AdminEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/admin/users/invite' && request.method === 'POST') {
    return handleInviteUser(request, env);
  }

  const patchMatch = /^\/api\/admin\/users\/([^/]+)$/.exec(path);
  if (patchMatch?.[1] && request.method === 'PATCH') {
    return handleUpdateUser(request, env, decodeURIComponent(patchMatch[1]));
  }

  const actionMatch = /^\/api\/admin\/users\/([^/]+)\/(deactivate|reactivate|resend-invite)$/.exec(
    path,
  );
  if (actionMatch?.[1] && actionMatch[2] && request.method === 'POST') {
    const userId = decodeURIComponent(actionMatch[1]);
    const action = actionMatch[2];
    if (action === 'deactivate') return handleDeactivateUser(request, env, userId);
    if (action === 'reactivate') return handleReactivateUser(request, env, userId);
    if (action === 'resend-invite') return handleResendInvite(request, env, userId);
  }

  if (path.startsWith('/api/')) {
    return errorResponse(404, 'not_found', 'Unbekannter API-Endpunkt.');
  }

  return null;
}
