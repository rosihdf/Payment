import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildContractSourceKey } from '../../../src/domain/contract/contractNumber';
import {
  buildOfferAfterWorkflowTransition,
  buildPublicAcceptanceActivitySourceKey,
  buildPublicAcceptanceEvent,
  buildPublicAcceptanceEventSourceKey,
  buildPublicDeclineActivitySourceKey,
  buildPublicDeclineEvent,
  buildPublicDeclineEventSourceKey,
  canPublicDecideOffer,
  findAcceptanceEventBySourceKey,
  findDeclineEventBySourceKey,
} from '../../../src/domain/offer/offerWorkflowTransitionCore';
import { errorResponse, type AdminEnv } from './adminUsersApi';

const MAX_TEXT_LENGTH = 4000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const ALLOWED_WORKFLOW = new Set(['approved', 'ready_to_send', 'sent']);

type ShareRow = {
  id: string;
  offer_id: string;
  offer_version_id: string;
  token_hash: string;
  status: string;
  valid_from: string;
  valid_until: string;
  revoked_at: string | null;
  superseded_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  created_by_user_id: string;
  data: Record<string, unknown>;
};

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function hashShareToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function securityHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

function sanitizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

function createServiceClient(env: AdminEnv): SupabaseClient {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error('SERVICE_ROLE_MISSING');
  return createClient(env.SUPABASE_URL.replace(/\/$/, ''), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

async function loadShareByToken(service: SupabaseClient, token: string): Promise<ShareRow | null> {
  const tokenHash = await hashShareToken(token);
  const { data, error } = await service
    .from('offer_share_links')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error || !data) return null;
  return data as ShareRow;
}

function resolveShareError(share: ShareRow, now: string): string | null {
  if (share.status === 'revoked' || share.revoked_at) return 'revoked';
  if (share.status === 'superseded' || share.superseded_at) return 'superseded';
  if (share.status === 'expired' || now > share.valid_until) return 'expired';
  if (share.status !== 'active' || now < share.valid_from) return 'invalid';
  return null;
}

async function recordFirstAccess(service: SupabaseClient, share: ShareRow, offer: Record<string, unknown>): Promise<void> {
  const sourceKey = `offer_share_first_access:${share.id}`;
  const { data: existing } = await service
    .from('sales_activities')
    .select('id')
    .eq('data->>sourceKey', sourceKey)
    .maybeSingle();
  if (existing) return;

  const timestamp = new Date().toISOString();
  const activityId = `sales_activity_${crypto.randomUUID()}`;
  await service.from('sales_activities').insert({
    id: activityId,
    created_by_user_id: share.created_by_user_id,
    lead_id: offer.lead_id ?? null,
    offer_id: share.offer_id,
    data: {
      id: activityId,
      schemaVersion: 1,
      type: 'status_change',
      title: 'Kunde hat Angebot geöffnet',
      description: 'Erster Zugriff über den Kundenlink.',
      occurredAt: timestamp,
      createdByUserId: share.created_by_user_id,
      leadId: offer.lead_id ?? null,
      offerId: share.offer_id,
      isSystem: true,
      editable: false,
      sourceKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    created_at: timestamp,
  });
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function buildPublicView(
  version: Record<string, unknown>,
  share: ShareRow,
  salesContactName: string,
  hasPdf: boolean,
) {
  const snapshot = (version.data as Record<string, unknown>)?.snapshot as Record<string, unknown>;
  const customer = snapshot.customerSnapshot as Record<string, unknown>;
  const totals = snapshot.totals as Record<string, number>;
  const tariff = snapshot.tariffSnapshot as Record<string, unknown> | null;
  const contactName = [customer.contactFirstName, customer.contactLastName].filter(Boolean).join(' ');

  return {
    companyName: customer.companyName,
    contactName,
    offerNumber: snapshot.offerNumber,
    versionNumber: version.version_number,
    versionCreatedAt: version.created_at,
    salesContactName,
    tariffName: tariff?.name ?? null,
    tariffProvider: tariff?.providerName ?? null,
    termMonths: snapshot.termMonths ?? null,
    oneTimeTotalLabel: formatMoney(totals.oneTimeTotalCents ?? 0),
    monthlyTotalLabel: formatMoney(totals.monthlyTotalCents ?? 0),
    transactionCostHint: tariff ? 'Transaktionsbezogene Kosten gemäß Tarifblatt' : 'Keine Tariftransaktionskosten hinterlegt',
    validUntil: snapshot.validUntil ?? null,
    linkValidUntil: share.valid_until,
    statusLabel: 'Zur Prüfung bereitgestellt',
    reviewHint: 'Bitte prüfen Sie das Angebot in Ruhe. Der Link ist zeitlich begrenzt gültig.',
    competitorComparisonHint: 'Ein Vergleich mit anderen Anbietern ist ausdrücklich möglich und empfohlen.',
    terminals: (snapshot.terminalLines as unknown[] | undefined) ?? [],
    accessories: (snapshot.accessoryLines as unknown[] | undefined) ?? [],
    hasPdf,
  };
}

async function handleGetPublicOffer(_request: Request, env: AdminEnv, token: string): Promise<Response> {
  let service: SupabaseClient;
  try {
    service = createServiceClient(env);
  } catch {
    return errorResponse(503, 'misconfigured', 'Der Service ist vorübergehend nicht verfügbar.');
  }

  const share = await loadShareByToken(service, token);
  if (!share) {
    return jsonResponse({ ok: false, error: 'invalid', message: 'Dieser Link ist ungültig.' }, 404);
  }

  const now = new Date().toISOString();
  const shareError = resolveShareError(share, now);
  if (shareError) {
    const messages: Record<string, string> = {
      revoked: 'Dieser Link wurde widerrufen.',
      superseded: 'Für dieses Angebot wurde eine neuere Version bereitgestellt. Bitte verwenden Sie den aktuellen Link.',
      expired: 'Dieser Link ist abgelaufen.',
      invalid: 'Dieser Link ist ungültig.',
    };
    return jsonResponse({ ok: false, error: shareError, message: messages[shareError] }, 410);
  }

  const [{ data: offer }, { data: version }] = await Promise.all([
    service.from('offers').select('*').eq('id', share.offer_id).maybeSingle(),
    service.from('offer_versions').select('*').eq('id', share.offer_version_id).maybeSingle(),
  ]);

  if (!offer || !version) {
    return jsonResponse({ ok: false, error: 'unavailable', message: 'Das Angebot ist nicht mehr verfügbar.' }, 404);
  }

  const offerData = offer.data as Record<string, unknown>;
  const workflowStatus = offerData.workflowStatus as string;
  const currentVersionId = offerData.currentVersionId as string | null;
  if (!ALLOWED_WORKFLOW.has(workflowStatus)) {
    return jsonResponse({ ok: false, error: 'unavailable', message: 'Das Angebot ist derzeit nicht zur Prüfung freigegeben.' }, 403);
  }

  if (currentVersionId && currentVersionId !== share.offer_version_id) {
    await service.from('offer_share_links').update({
      status: 'superseded',
      superseded_at: now,
      updated_at: now,
      data: { ...share.data, status: 'superseded', supersededAt: now },
    }).eq('id', share.id);
    return jsonResponse({
      ok: false,
      error: 'superseded',
      message: 'Für dieses Angebot wurde eine neuere Version bereitgestellt. Bitte verwenden Sie den aktuellen Link.',
    }, 410);
  }

  const { data: documents } = await service
    .from('offer_documents')
    .select('id,data')
    .eq('offer_id', share.offer_id);

  const hasPdf = (documents ?? []).some((doc) => {
    const data = doc.data as Record<string, unknown>;
    return data.offerVersionId === share.offer_version_id && data.status !== 'superseded';
  });

  const wasFirstAccess = share.access_count === 0;
  await service.from('offer_share_links').update({
    access_count: share.access_count + 1,
    last_accessed_at: now,
    updated_at: now,
    data: {
      ...share.data,
      accessCount: share.access_count + 1,
      lastAccessAt: now,
    },
  }).eq('id', share.id);

  if (wasFirstAccess) {
    await recordFirstAccess(service, share, offer);
  }

  const creator = await service.from('profiles').select('display_name').eq('user_id', share.created_by_user_id).maybeSingle();
  const view = buildPublicView(version, share, creator.data?.display_name ?? 'AMRtech', hasPdf);
  return jsonResponse({ ok: true, view }, 200);
}

async function handlePostQuestion(request: Request, env: AdminEnv, token: string): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!checkRateLimit(`question:${token}:${ip}`)) {
    return errorResponse(429, 'rate_limited', 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return errorResponse(400, 'invalid_json', 'Ungültige Anfrage.');
  }

  const questionText = sanitizeText(body.questionText);
  if (!questionText) return errorResponse(400, 'validation', 'Bitte geben Sie eine Rückfrage ein.');
  if (questionText.length > MAX_TEXT_LENGTH) {
    return errorResponse(400, 'validation', 'Die Rückfrage ist zu lang.');
  }

  let service: SupabaseClient;
  try {
    service = createServiceClient(env);
  } catch {
    return errorResponse(503, 'misconfigured', 'Der Service ist vorübergehend nicht verfügbar.');
  }

  const share = await loadShareByToken(service, token);
  const now = new Date().toISOString();
  if (!share || resolveShareError(share, now)) {
    return errorResponse(410, 'invalid_link', 'Dieser Link ist nicht mehr gültig.');
  }

  const timestamp = now;
  const questionId = `offer_question_${crypto.randomUUID()}`;
  const question = {
    id: questionId,
    offerId: share.offer_id,
    offerVersionId: share.offer_version_id,
    shareId: share.id,
    questionText,
    customerName: sanitizeText(body.customerName) || null,
    customerEmail: sanitizeText(body.customerEmail) || null,
    status: 'open',
    answerText: null,
    answeredByUserId: null,
    askedAt: timestamp,
    answeredAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await service.from('offer_customer_questions').insert({
    id: questionId,
    offer_id: share.offer_id,
    offer_version_id: share.offer_version_id,
    share_id: share.id,
    question_text: questionText,
    customer_name: question.customerName,
    customer_email: question.customerEmail,
    status: 'open',
    asked_at: timestamp,
    data: question,
    created_at: timestamp,
    updated_at: timestamp,
  });

  const { data: offer } = await service.from('offers').select('lead_id, data').eq('id', share.offer_id).maybeSingle();
  const activityId = `sales_activity_${crypto.randomUUID()}`;
  await service.from('sales_activities').insert({
    id: activityId,
    created_by_user_id: share.created_by_user_id,
    lead_id: offer?.lead_id ?? null,
    offer_id: share.offer_id,
    data: {
      id: activityId,
      schemaVersion: 1,
      type: 'status_change',
      title: 'Kunde hat Rückfrage gestellt',
      description: questionText.slice(0, 160),
      occurredAt: timestamp,
      createdByUserId: share.created_by_user_id,
      leadId: offer?.lead_id ?? null,
      offerId: share.offer_id,
      isSystem: true,
      editable: false,
      sourceKey: `offer_question_submitted:${questionId}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    created_at: timestamp,
  });
  // Fachstatus für interne UI – Workflow bleibt kundenseitig offen.
  if (offer?.data && typeof offer.data === 'object') {
    const data = offer.data as Record<string, unknown>;
    await service
      .from('offers')
      .update({
        data: { ...data, customerFeedbackStatus: 'question_received', updatedAt: timestamp },
        updated_at: timestamp,
      })
      .eq('id', share.offer_id);
  }

  return jsonResponse({ ok: true }, 201);
}

async function handlePostChangeRequest(request: Request, env: AdminEnv, token: string): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!checkRateLimit(`change:${token}:${ip}`)) {
    return errorResponse(429, 'rate_limited', 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return errorResponse(400, 'invalid_json', 'Ungültige Anfrage.');
  }

  const requestText = sanitizeText(body.requestText);
  if (!requestText) return errorResponse(400, 'validation', 'Bitte beschreiben Sie den Änderungswunsch.');
  if (requestText.length > MAX_TEXT_LENGTH) {
    return errorResponse(400, 'validation', 'Der Änderungswunsch ist zu lang.');
  }

  let service: SupabaseClient;
  try {
    service = createServiceClient(env);
  } catch {
    return errorResponse(503, 'misconfigured', 'Der Service ist vorübergehend nicht verfügbar.');
  }

  const share = await loadShareByToken(service, token);
  const now = new Date().toISOString();
  if (!share || resolveShareError(share, now)) {
    return errorResponse(410, 'invalid_link', 'Dieser Link ist nicht mehr gültig.');
  }

  const timestamp = now;
  const changeId = `offer_change_${crypto.randomUUID()}`;
  const changeRequest = {
    id: changeId,
    offerId: share.offer_id,
    offerVersionId: share.offer_version_id,
    shareId: share.id,
    requestText,
    customerName: sanitizeText(body.customerName) || null,
    customerEmail: sanitizeText(body.customerEmail) || null,
    status: 'open',
    handledByUserId: null,
    handledAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await service.from('offer_change_requests').insert({
    id: changeId,
    offer_id: share.offer_id,
    offer_version_id: share.offer_version_id,
    share_id: share.id,
    request_text: requestText,
    customer_name: changeRequest.customerName,
    customer_email: changeRequest.customerEmail,
    status: 'open',
    data: changeRequest,
    created_at: timestamp,
    updated_at: timestamp,
  });

  const { data: offer } = await service.from('offers').select('lead_id, data').eq('id', share.offer_id).maybeSingle();
  const activityId = `sales_activity_${crypto.randomUUID()}`;
  await service.from('sales_activities').insert({
    id: activityId,
    created_by_user_id: share.created_by_user_id,
    lead_id: offer?.lead_id ?? null,
    offer_id: share.offer_id,
    data: {
      id: activityId,
      schemaVersion: 1,
      type: 'status_change',
      title: 'Kunde wünscht Änderung',
      description: requestText.slice(0, 160),
      occurredAt: timestamp,
      createdByUserId: share.created_by_user_id,
      leadId: offer?.lead_id ?? null,
      offerId: share.offer_id,
      isSystem: true,
      editable: false,
      sourceKey: `offer_change_requested:${changeId}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    created_at: timestamp,
  });
  await applyCustomerFeedbackStatus(service, share.offer_id, 'changes_requested', {
    customerFeedbackStatus: 'change_requested',
  });

  return jsonResponse({ ok: true }, 201);
}

async function handleGetPdfData(_request: Request, env: AdminEnv, token: string): Promise<Response> {
  let service: SupabaseClient;
  try {
    service = createServiceClient(env);
  } catch {
    return errorResponse(503, 'misconfigured', 'Der Service ist vorübergehend nicht verfügbar.');
  }

  const share = await loadShareByToken(service, token);
  const now = new Date().toISOString();
  if (!share || resolveShareError(share, now)) {
    return errorResponse(410, 'invalid_link', 'Dieser Link ist nicht mehr gültig.');
  }

  const { data: documents } = await service.from('offer_documents').select('data').eq('offer_id', share.offer_id);
  const document = (documents ?? []).find((entry) => {
    const data = entry.data as Record<string, unknown>;
    return data.offerVersionId === share.offer_version_id && data.status !== 'superseded';
  });

  if (!document) {
    return errorResponse(404, 'not_found', 'Für diese Version ist kein PDF verfügbar.');
  }

  return jsonResponse({
    ok: true,
    documentSnapshot: (document.data as Record<string, unknown>).snapshot ?? null,
  }, 200);
}

function jsonResponse(body: unknown, status = 200): Response {
  const headers = securityHeaders();
  return new Response(JSON.stringify(body), { status, headers });
}

async function updateOfferFromSnapshot(
  service: SupabaseClient,
  offerId: string,
  snapshot: ReturnType<typeof buildOfferAfterWorkflowTransition>,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (!snapshot) return;
  const { data: offer } = await service.from('offers').select('data').eq('id', offerId).maybeSingle();
  if (!offer?.data || typeof offer.data !== 'object') return;
  const data = offer.data as Record<string, unknown>;
  const now = new Date().toISOString();
  await service
    .from('offers')
    .update({
      data: {
        ...data,
        ...extra,
        workflowStatus: snapshot.workflowStatus,
        status: snapshot.status,
        updatedAt: now,
        completedAt: snapshot.completedAt,
        completedByUserId: snapshot.completedByUserId,
        cancelledAt: snapshot.cancelledAt,
        cancelledByUserId: snapshot.cancelledByUserId,
      },
      updated_at: now,
    })
    .eq('id', offerId);
}

async function insertWorkflowEvent(
  service: SupabaseClient,
  event: Record<string, unknown>,
): Promise<void> {
  await service.from('offer_workflow_events').insert({
    id: event.id,
    offer_id: event.offerId,
    event_type: event.type,
    created_by_user_id: event.createdByUserId,
    data: event,
    created_at: event.createdAt,
  });
}

async function recordActivityIfMissing(
  service: SupabaseClient,
  input: {
    sourceKey: string;
    offerId: string;
    leadId: string | null;
    createdByUserId: string;
    title: string;
    description: string;
  },
): Promise<void> {
  const { data: existing } = await service
    .from('sales_activities')
    .select('id')
    .eq('data->>sourceKey', input.sourceKey)
    .maybeSingle();
  if (existing) return;

  const timestamp = new Date().toISOString();
  const activityId = `sales_activity_${crypto.randomUUID()}`;
  await service.from('sales_activities').insert({
    id: activityId,
    created_by_user_id: input.createdByUserId,
    lead_id: input.leadId,
    offer_id: input.offerId,
    data: {
      id: activityId,
      schemaVersion: 1,
      type: 'status_change',
      title: input.title,
      description: input.description,
      occurredAt: timestamp,
      createdByUserId: input.createdByUserId,
      leadId: input.leadId,
      offerId: input.offerId,
      isSystem: true,
      editable: false,
      sourceKey: input.sourceKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    created_at: timestamp,
  });
}

async function ensureContractNotDuplicated(
  service: SupabaseClient,
  offerId: string,
  offerVersionId: string,
): Promise<void> {
  const sourceKey = buildContractSourceKey(offerId, offerVersionId);
  const [{ data: byOffer }, { data: byKey }] = await Promise.all([
    service.from('contracts').select('id').eq('source_offer_id', offerId).maybeSingle(),
    service.from('contracts').select('id').eq('data->>sourceKey', sourceKey).maybeSingle(),
  ]);
  if (byOffer || byKey) {
    return;
  }
}

async function applyCustomerFeedbackStatus(
  service: SupabaseClient,
  offerId: string,
  workflowStatus: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const { data: offer } = await service.from('offers').select('data').eq('id', offerId).maybeSingle();
  if (!offer?.data || typeof offer.data !== 'object') return;
  const data = offer.data as Record<string, unknown>;
  const now = new Date().toISOString();
  await service
    .from('offers')
    .update({
      data: {
        ...data,
        ...extra,
        workflowStatus,
        updatedAt: now,
      },
      updated_at: now,
    })
    .eq('id', offerId);
}

async function loadWorkflowEvents(
  service: SupabaseClient,
  offerId: string,
): Promise<Array<Record<string, unknown>>> {
  const { data } = await service
    .from('offer_workflow_events')
    .select('data')
    .eq('offer_id', offerId);
  return (data ?? [])
    .map((row) => row.data as Record<string, unknown>)
    .filter(Boolean);
}

async function handlePostDecision(
  request: Request,
  env: AdminEnv,
  token: string,
  decision: 'accept' | 'decline',
): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!checkRateLimit(`decision:${token}:${ip}`)) {
    return errorResponse(429, 'rate_limited', 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.');
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  let service: SupabaseClient;
  try {
    service = createServiceClient(env);
  } catch {
    return errorResponse(503, 'misconfigured', 'Der Service ist vorübergehend nicht verfügbar.');
  }

  const share = await loadShareByToken(service, token);
  const now = new Date().toISOString();
  if (!share || resolveShareError(share, now)) {
    return errorResponse(410, 'invalid_link', 'Dieser Link ist nicht mehr gültig.');
  }

  const { data: offerRow } = await service
    .from('offers')
    .select('lead_id, data')
    .eq('id', share.offer_id)
    .maybeSingle();
  const offerData = (offerRow?.data ?? {}) as Record<string, unknown>;
  const workflowStatus = String(offerData.workflowStatus ?? '');
  if (!canPublicDecideOffer(workflowStatus as never)) {
    return errorResponse(403, 'unavailable', 'Das Angebot ist derzeit nicht entscheidbar.');
  }

  const customerName = sanitizeText(body.customerName) || 'Kunde';
  const note = sanitizeText(body.note);
  const events = await loadWorkflowEvents(service, share.offer_id);
  const offerSnapshot = {
    id: share.offer_id,
    workflowStatus: workflowStatus as never,
    status: String(offerData.status ?? 'draft') as 'draft' | 'completed' | 'cancelled',
    currentVersionId: String(offerData.currentVersionId ?? share.offer_version_id),
    leadId: offerRow?.lead_id ?? null,
    createdByUserId: share.created_by_user_id,
    completedAt: typeof offerData.completedAt === 'string' ? offerData.completedAt : null,
    completedByUserId: typeof offerData.completedByUserId === 'string' ? offerData.completedByUserId : null,
    cancelledAt: typeof offerData.cancelledAt === 'string' ? offerData.cancelledAt : null,
    cancelledByUserId: typeof offerData.cancelledByUserId === 'string' ? offerData.cancelledByUserId : null,
    updatedAt: now,
  };

  if (decision === 'accept') {
    const acceptanceSourceKey = buildPublicAcceptanceEventSourceKey(share.offer_id, share.id);
    if (
      findAcceptanceEventBySourceKey(events as never, acceptanceSourceKey) ||
      workflowStatus === 'accepted'
    ) {
      return jsonResponse({ ok: true, decision, duplicate: true }, 200);
    }

    const nextSnapshot = buildOfferAfterWorkflowTransition(offerSnapshot, 'accept', {
      userId: share.created_by_user_id,
      timestamp: now,
    });
    if (!nextSnapshot) {
      return errorResponse(403, 'invalid_transition', 'Annahme ist derzeit nicht möglich.');
    }

    const acceptanceEvent = buildPublicAcceptanceEvent({
      offerId: share.offer_id,
      offerVersionId: share.offer_version_id,
      shareId: share.id,
      acceptedByName: customerName,
      note,
      timestamp: now,
      createdByUserId: share.created_by_user_id,
      createdByDisplayName: 'Kunde',
    });

    const { data: existingAcceptance } = await service
      .from('offer_customer_acceptances')
      .select('id')
      .eq('offer_id', share.offer_id)
      .eq('offer_version_id', share.offer_version_id)
      .maybeSingle();

    if (!existingAcceptance) {
      await service.from('offer_customer_acceptances').insert({
        id: acceptanceEvent.id,
        offer_id: share.offer_id,
        offer_version_id: share.offer_version_id,
        data: {
          id: acceptanceEvent.id,
          offerId: share.offer_id,
          offerVersionId: share.offer_version_id,
          acceptorName: customerName,
          acceptedAt: now,
          ipAddress: ip === 'unknown' ? null : ip,
          userAgent: request.headers.get('User-Agent'),
          checkboxes: {
            offerReviewed: true,
            termsUnderstood: true,
            acceptanceIntended: true,
          },
          comment: note,
          shareId: share.id,
          createdAt: now,
        },
        created_at: now,
        updated_at: now,
      });
    }

    await updateOfferFromSnapshot(service, share.offer_id, nextSnapshot, {
      acceptedAt: now,
    });
    await insertWorkflowEvent(service, acceptanceEvent as unknown as Record<string, unknown>);
    await ensureContractNotDuplicated(service, share.offer_id, share.offer_version_id);
    await recordActivityIfMissing(service, {
      sourceKey: buildPublicAcceptanceActivitySourceKey(share.offer_id, share.id),
      offerId: share.offer_id,
      leadId: offerRow?.lead_id ?? null,
      createdByUserId: share.created_by_user_id,
      title: 'Kunde hat Angebot angenommen',
      description: note.slice(0, 160),
    });
  } else {
    const declineSourceKey = buildPublicDeclineEventSourceKey(share.offer_id, share.id);
    if (
      findDeclineEventBySourceKey(events as never, declineSourceKey) ||
      workflowStatus === 'declined'
    ) {
      return jsonResponse({ ok: true, decision, duplicate: true }, 200);
    }

    const nextSnapshot = buildOfferAfterWorkflowTransition(offerSnapshot, 'decline', {
      userId: share.created_by_user_id,
      timestamp: now,
    });
    if (!nextSnapshot) {
      return errorResponse(403, 'invalid_transition', 'Ablehnung ist derzeit nicht möglich.');
    }

    const declineEvent = buildPublicDeclineEvent({
      offerId: share.offer_id,
      offerVersionId: share.offer_version_id,
      shareId: share.id,
      note,
      timestamp: now,
      createdByUserId: share.created_by_user_id,
      createdByDisplayName: 'Kunde',
    });

    await updateOfferFromSnapshot(service, share.offer_id, nextSnapshot, {
      declinedAt: now,
    });
    await insertWorkflowEvent(service, declineEvent as unknown as Record<string, unknown>);
    await recordActivityIfMissing(service, {
      sourceKey: buildPublicDeclineActivitySourceKey(share.offer_id, share.id),
      offerId: share.offer_id,
      leadId: offerRow?.lead_id ?? null,
      createdByUserId: share.created_by_user_id,
      title: 'Kunde hat Angebot abgelehnt',
      description: note.slice(0, 160),
    });
  }

  return jsonResponse({ ok: true, decision }, 201);
}

export async function routePublicOfferApi(request: Request, env: AdminEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const match =
    /^\/api\/public\/offers\/([^/]+)(?:\/(questions|change-requests|pdf|accept|decline))?$/.exec(
      url.pathname,
    );
  if (!match) return null;

  const token = decodeURIComponent(match[1] ?? '');
  const action = match[2];

  if (!token || token.length < 16) {
    return errorResponse(400, 'invalid', 'Ungültiger Link.');
  }

  if (request.method === 'GET' && !action) {
    return handleGetPublicOffer(request, env, token);
  }
  if (request.method === 'GET' && action === 'pdf') {
    return handleGetPdfData(request, env, token);
  }
  if (request.method === 'POST' && action === 'questions') {
    return handlePostQuestion(request, env, token);
  }
  if (request.method === 'POST' && action === 'change-requests') {
    return handlePostChangeRequest(request, env, token);
  }
  if (request.method === 'POST' && action === 'accept') {
    return handlePostDecision(request, env, token, 'accept');
  }
  if (request.method === 'POST' && action === 'decline') {
    return handlePostDecision(request, env, token, 'decline');
  }

  return errorResponse(405, 'method_not_allowed', 'Methode nicht erlaubt.');
}
