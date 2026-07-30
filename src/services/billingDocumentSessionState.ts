import type { BillingExtractionProgress } from '../domain/billingImportEngine/billingOcrConfig';

interface DocumentSessionState {
  rotationDegrees: number;
  abortController: AbortController | null;
  progress: BillingExtractionProgress | null;
}

const documentStates = new Map<string, DocumentSessionState>();
const sessionAbortControllers = new Map<string, AbortController>();

function documentKey(sessionId: string, documentId: string): string {
  return `${sessionId}:${documentId}`;
}

export function getDocumentRotation(sessionId: string, documentId: string): number {
  return documentStates.get(documentKey(sessionId, documentId))?.rotationDegrees ?? 0;
}

export function setDocumentRotation(
  sessionId: string,
  documentId: string,
  rotationDegrees: number,
): void {
  const key = documentKey(sessionId, documentId);
  const existing = documentStates.get(key) ?? { rotationDegrees: 0, abortController: null, progress: null };
  documentStates.set(key, { ...existing, rotationDegrees: ((rotationDegrees % 360) + 360) % 360 });
}

export function rotateDocumentLeft(sessionId: string, documentId: string): number {
  const current = getDocumentRotation(sessionId, documentId);
  const next = (current - 90 + 360) % 360;
  setDocumentRotation(sessionId, documentId, next);
  return next;
}

export function rotateDocumentRight(sessionId: string, documentId: string): number {
  const current = getDocumentRotation(sessionId, documentId);
  const next = (current + 90) % 360;
  setDocumentRotation(sessionId, documentId, next);
  return next;
}

export function resetDocumentRotation(sessionId: string, documentId: string): void {
  setDocumentRotation(sessionId, documentId, 0);
}

export function setDocumentProgress(
  sessionId: string,
  documentId: string,
  progress: BillingExtractionProgress | null,
): void {
  const key = documentKey(sessionId, documentId);
  const existing = documentStates.get(key) ?? { rotationDegrees: 0, abortController: null, progress: null };
  documentStates.set(key, { ...existing, progress });
}

export function getDocumentProgress(
  sessionId: string,
  documentId: string,
): BillingExtractionProgress | null {
  return documentStates.get(documentKey(sessionId, documentId))?.progress ?? null;
}

export function createSessionAbortController(sessionId: string): AbortController {
  cancelSessionExtraction(sessionId);
  const controller = new AbortController();
  sessionAbortControllers.set(sessionId, controller);
  return controller;
}

export function getSessionAbortController(sessionId: string): AbortController | null {
  return sessionAbortControllers.get(sessionId) ?? null;
}

export function cancelSessionExtraction(sessionId: string): void {
  const controller = sessionAbortControllers.get(sessionId);
  if (controller) {
    controller.abort();
    sessionAbortControllers.delete(sessionId);
  }
}

export function clearDocumentSessionState(sessionId: string): void {
  for (const key of documentStates.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      documentStates.delete(key);
    }
  }
  sessionAbortControllers.delete(sessionId);
}

export function __clearAllDocumentSessionStateForTests(): void {
  documentStates.clear();
  sessionAbortControllers.clear();
}
