/** Synthetische, anonymisierte Abrechnungstexte für Parser-/Erkennungstests (keine Kundendaten). */
export const SYNTHETIC_CLEAR_BILLING_TEXT = `
SumUp
Monatsabrechnung
Zeitraum: 01.01.2026 - 31.01.2026
Kartenumsatz 12.345,67 EUR
Anzahl Transaktionen 420
Grundgebühr 29,00 EUR
Terminalmiete 19,00 EUR
Transaktionsgebühren 41,50 EUR
Servicegebühr 0,00 EUR
Monatliche Gesamtkosten 89,50 EUR
`.trim();

export const SYNTHETIC_NOISY_BILLING_TEXT = `
Abrechnung Scan
U m s a t z Karten 1.234,56
Transaktionen ca. 88
Summe netto 45,00
MwSt. 8,55
Endbetrag 53,55
`.trim();

export const SYNTHETIC_AMBIGUOUS_SUMS_TEXT = `
TeleCash Abrechnung
Kartenumsatz 8.000,00 EUR
Rechnungsbetrag 120,00 EUR
Gesamtbetrag 1.440,00 EUR
Jahreskosten 1.440,00 EUR
`.trim();
