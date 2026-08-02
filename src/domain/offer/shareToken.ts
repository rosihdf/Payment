/**
 * Share-Token-Erzeugung und Hashing – nur serverseitig / in Services verwenden.
 * Phase 1B Block 1: Vorbereitung, kein öffentlicher Endpunkt.
 */

export function generateShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashShareToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyShareToken(token: string, tokenHash: string): Promise<boolean> {
  const computed = await hashShareToken(token);
  return computed === tokenHash;
}
