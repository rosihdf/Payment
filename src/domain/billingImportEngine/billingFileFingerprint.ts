export async function fingerprintBillingFileContent(content: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', content);
    const bytes = Array.from(new Uint8Array(digest));
    return `sha256:${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }

  const view = new Uint8Array(content);
  let hash = 0;
  for (let index = 0; index < view.length; index += 1) {
    hash = (hash << 5) - hash + view[index]!;
    hash |= 0;
  }
  return `fallback:${Math.abs(hash).toString(16)}:${view.length}`;
}

export function fingerprintBillingText(text: string): string {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return `text:${Math.abs(hash).toString(16)}:${text.length}`;
}
