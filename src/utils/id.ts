export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
