export function commissionErrorLabel(error: string): string {
  switch (error) {
    case 'forbidden':
    case 'unauthenticated':
      return 'Keine Berechtigung für Provisionsverwaltung';
    case 'share_range':
      return 'Anteil muss zwischen 0 und 100 % liegen (ganzzahlig)';
    case 'overlap':
      return 'Der Zeitraum überschneidet sich mit einer bestehenden Vereinbarung';
    case 'invalid_validity':
      return 'Der Gültigkeitszeitraum ist ungültig';
    case 'invalid_amount':
      return 'Der Betrag ist ungültig';
    case 'profile_not_found':
      return 'Zielprofil nicht gefunden';
    case 'rule_not_found':
      return 'Provisionsregel oder -modell nicht gefunden';
    case 'version_conflict':
      return 'Die Vereinbarung wurde zwischenzeitlich geändert – bitte neu laden';
    case 'network_error':
      return 'Netzwerkfehler – Eingaben bleiben erhalten, bitte erneut speichern';
    case 'database_error':
      return 'Speichern fehlgeschlagen – bitte erneut versuchen';
    case 'validation':
      return 'Bitte alle Pflichtfelder ausfüllen';
    case 'not_found':
      return 'Datensatz nicht gefunden';
    default:
      return error;
  }
}
