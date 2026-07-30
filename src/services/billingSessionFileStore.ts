/** Temporärer Dateispeicher nur für die aktuelle Browser-Sitzung – keine localStorage-Persistenz. */

const sessionFiles = new Map<string, Map<string, { file: File; objectUrl: string | null }>>();

export function storeSessionFile(sessionId: string, documentId: string, file: File): string {
  const bucket = sessionFiles.get(sessionId) ?? new Map();
  const objectUrl = URL.createObjectURL(file);
  bucket.set(documentId, { file, objectUrl });
  sessionFiles.set(sessionId, bucket);
  return objectUrl;
}

export function getSessionFile(sessionId: string, documentId: string): File | null {
  return sessionFiles.get(sessionId)?.get(documentId)?.file ?? null;
}

export function getSessionFilePreviewUrl(sessionId: string, documentId: string): string | null {
  return sessionFiles.get(sessionId)?.get(documentId)?.objectUrl ?? null;
}

export function removeSessionFile(sessionId: string, documentId: string): void {
  const bucket = sessionFiles.get(sessionId);
  const entry = bucket?.get(documentId);
  if (entry?.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
  }
  bucket?.delete(documentId);
}

export function clearSessionFiles(sessionId: string): void {
  const bucket = sessionFiles.get(sessionId);
  if (!bucket) {
    return;
  }
  for (const entry of bucket.values()) {
    if (entry.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
    }
  }
  sessionFiles.delete(sessionId);
}

export function resetSessionFileStoreForTests(): void {
  for (const sessionId of sessionFiles.keys()) {
    clearSessionFiles(sessionId);
  }
  sessionFiles.clear();
}
