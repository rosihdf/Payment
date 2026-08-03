export function formatPersistError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    const colonIndex = message.indexOf(': ');
    if (colonIndex >= 0) {
      return message.slice(colonIndex + 2).trim() || message;
    }
    return message;
  }
  return 'Speichern fehlgeschlagen';
}
