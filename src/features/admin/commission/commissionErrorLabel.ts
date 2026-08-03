export function commissionErrorLabel(error: string): string {
  switch (error) {
    case 'forbidden':
      return 'Keine Berechtigung für Provisionsverwaltung';
    case 'share_range':
      return 'Anteil muss zwischen 0 und 100 % liegen (ganzzahlig)';
    case 'overlap':
      return 'Der Zeitraum überschneidet sich mit einer bestehenden Vereinbarung';
    case 'validation':
      return 'Bitte alle Pflichtfelder ausfüllen';
    case 'not_found':
      return 'Datensatz nicht gefunden';
    default:
      return error;
  }
}
