# Fachkonzept Phase 1B – Digitaler Vertriebsprozess (BestPay)

**Status:** Entwurf zur Product-Owner-Freigabe  
**Version:** 1.1 / Phase 1B  
**Stand:** 2026-08-02  
**Art:** Nur Fachkonzept – keine Implementierung, keine Migration, keine UI-Umsetzung in diesem Schritt  

**Verbindliche Grundlagen:**

- [`docs/AMRtech-Payment-Produktleitlinien.md`](../AMRtech-Payment-Produktleitlinien.md)
- Roadmap 1.1 (Phase 2: Digitaler Vertriebsprozess – fachlich als Phase 1B spezifiziert)
- [`docs/fachkonzepte/Phase-1A-CRM-Grundlage.md`](Phase-1A-CRM-Grundlage.md)
- Gold Master `v1.0.0` + umgesetzte Phase 1A

**Leitprinzip:** Der interne BestPay-Vertriebsprozess wird um Kundenprüfung, Rückfragen, dokumentierte Annahme und Übergabe an den **externen** BestPay-Abschluss erweitert. Keine zweite Angebots- oder Vertragswelt. Der externe BestPay-Vertragsabschluss bleibt führend.

---

## 0. Abgrenzung Phase 1B

| In Scope 1B | Explizit nicht in 1B |
|-------------|----------------------|
| Sichere Angebotsbereitstellung für den Kunden (Share-Link) | Allgemeines Kundenportal / Registrierung / Menüplattform |
| Kundenansicht einer freigegebenen Angebotsversion | Multi-Anbieter / Marktplatz |
| Textliche Rückfragen zur Angebotsversion | Eigener BestPay-Vertragsgenerator |
| Änderungswünsche des Kunden | Rechtsverbindlicher Paymentabschluss in AMRtech Payment |
| Dokumentierte digitale Angebotsannahme (Kundenwille) | Qualifizierte elektronische Signatur als Pflicht |
| Interne Freigabe bleibt alleinige Wahrheit | Zweite Freigabe-/Angebotslogik |
| Interner BestPay-Handoff + Status | Eigener Vertragsschluss / Signatur als Abschluss |
| Schlanke Hinweise über bestehende Activity-/Arbeitsplatz-Logik | Allgemeine Notification-Plattform |
| Mobile schlanke Angebotsseite | Phase-4-Dokumentencenter / Support-Chat |

**Nutzenprüfung (Leitlinien):** Erkennbarer Nutzen für Kunde (Prüfen/Fragen/Annahme), Außendienst (weniger Medienbruch) und Administration (Nachvollziehbarkeit); Arbeit vereinfachen – keine Parallelwelt.

---

## 1. Ziel

### Warum?

Nach Beratung und Angebot braucht der Kunde Zeit zum Prüfen und Nachfragen. Heute fehlen ein sicherer, versionstreuer Kundenkanal und eine klare, dokumentierte Übergabe an den externen BestPay-Abschluss.

### Welches Problem?

- Angebote werden oft per Mail/Datei geteilt – ohne gebundene Version und ohne Audit.
- Rückfragen und Änderungswünsche landen außerhalb der Kundenakte.
- „Annahme“ und „BestPay-Vertragsabschluss“ drohen vermischt zu werden.
- Ohne Handoff-Status fehlt Transparenz zwischen Annahme und externem Abschluss.

### Nutzen

| Rolle | Nutzen |
|-------|--------|
| **Kunde** | Angebot sicher prüfen, Rückfragen stellen, Wille dokumentieren – ohne Portal-Konto |
| **Außendienst** | Eine Spur in Akte/Angebot; neue Version bei Bedarf; klare Übergabe an BestPay |
| **Administration** | Nachvollziehbare Freigabe, Annahme und Handoff; kein Schattenprozess |

---

## 2. Verbindlicher Prozess (1B)

Erweitert ausschließlich den bestehenden Prozess (Produktleitlinien Kap. 4):

```
Angebot
  ↓
interne Freigabe bei Abweichung (bestehende Approval-Wahrheit)
  ↓
sicherer Kundenlink (exakt eine freigegebene Version)
  ↓
Kunde prüft in Ruhe
  ↓
Rückfrage oder Änderungswunsch
  ↓
gegebenenfalls neue Angebotsversion (+ erneute Freigabeprüfung)
  ↓
interne Annahmebestätigung (Kundenwille, kein BestPay-Vertrag)
  ↓
Übergabe an externen BestPay-Abschluss
  ↓
Statusnachverfolgung (Handoff)
  ↓
(weiter wie 1.0: Aktivierung / Provision)
```

**Explizit:** Annahme ≠ BestPay-Vertragsabschluss. Der Abschluss erfolgt nur über offizielle externe BestPay-Prozesse.

---

## 3. A. Externer Angebotszugang (Share-Link)

### Zweck

Ein sicherer, zeitlich begrenzter Zugang zu **genau einer** freigegebenen Angebotsversion – ohne allgemeines Kundenkonto und ohne Portal.

### Eigenschaften

| Merkmal | Regel |
|---------|--------|
| Token | Zufällig, kryptographisch stark, nicht erratbar |
| Speicherung | Token nur als Hash speichern (Klartext nur einmalig bei Erzeugung anzeigen/kopieren) |
| Bindung | `offerId` + `offerVersionId` fest |
| Ablauf | Pflicht-Ablaufdatum; nach Ablauf kein Zugriff (Standardlaufzeit: PO, Kap. 15) |
| Widerruf | Sofortiger Entzug durch Admin oder berechtigten Außendienst |
| Sichtbarkeit | Nur die gebundene Version; keine internen Daten; keine anderen Kunden |
| Voraussetzung | Version muss freigegeben / bereitstellungsfähig sein (siehe Freigabe) |
| Kein Konto | Zugriff **ohne** allgemeines Kundenkonto |
| Kein Portal | Keine Registrierung, keine Suche, kein Menü anderer Vorgänge |
| Zugangsweg | Öffentliche Zugriffe nur über eng begrenzte **serverseitige** Endpunkte |

### Lebenszyklus Share-Link

| Status | Bedeutung |
|--------|-----------|
| `active` | Gültig bis Ablauf, nicht widerrufen |
| `expired` | Ablaufdatum erreicht |
| `revoked` | Manuell widerrufen |
| `superseded` | Optional: durch neue Vorlagen-Version ersetzt (PO, Kap. 15) |

### Erzeugen

- Nur wenn Angebot/Version freigegeben und für Kundenvorlage zulässig
- Außendienst: eigene/zugeordnete Angebote; Admin: alle
- Erzeugung erzeugt Activity/Arbeitsplatz-Hinweis „Angebot bereitgestellt“ (intern + optional Kunden-Hinweiskanal, Kap. 10)

---

## 4. B. Kundenansicht

Eine schlanke, mobile nutzbare Seite. Kein Portal-Menü.

### Sichtbar für den Kunden

- Firmenname (Kundenfirma)
- Ansprechpartner AMRtech (zuständiger Außendienst / Anzeigename)
- Angebotsnummer
- Version
- Erstellungsdatum der Version
- Tarif
- Hardware
- Zubehör
- Laufzeit
- Einmalige Kosten
- Laufende Kosten
- Transaktionsbezogene Kosten
- PDF (Angebotsdokument der Version)
- Hinweis auf Prüfzeit / Gültigkeit des Links
- Mitbewerbervergleich ausdrücklich erlaubt (Hinweistext; kein Multi-Anbieter-Portal in AMRtech Payment)
- Aktueller Status aus Kundensicht (z. B. zur Prüfung, angenommen, Link ungültig)

### Nicht sichtbar

- Provision und Provisionsdetails
- Interne Freigaben / Freigabegründe
- Interne Notizen
- Preisgrenzen / interne Abweichungslogik
- Audit-Details
- Andere Kunden oder andere Angebote
- Interne Tasks / Timeline-Systemevents

---

## 5. C. Rückfragen

### Prinzip

Schlanke, versionstreue Textkommunikation – **keine** Chatplattform.

| Regel | Detail |
|-------|--------|
| Inhalt | Textliche Rückfrage des Kunden |
| Bindung | Exakt eine `offerVersionId` |
| Sicht intern | In Angebotsdetail und Kundenakte (Angebotskontext) |
| Antwort | Außendienst/Admin antwortet textlich; Antwort wird dokumentiert |
| Uploads | Im ersten Schritt **keine** Datei-Uploads (nicht zwingend) |
| Thread | Einfache Frage–Antwort-Paare oder kurze Kette je Frage; kein allgemeiner Messenger |

### Status (Rückfrage)

`open` → `answered` → optional `closed`

---

## 6. D. Änderungswunsch

| Regel | Detail |
|-------|--------|
| Auslöser | Kunde markiert Änderungswunsch + freie Beschreibung |
| Bindung | Angebotsversion, auf der der Wunsch entstand |
| Status | offen / geprüft / beantwortet / erledigt (`open` / `reviewed` / `answered` / `done`) |
| Wirkung | **Keine** automatische Vertrags- oder Angebotsmutation |
| Folge | Außendienst prüft; bei Bedarf **neue** Angebotsversion; neue Version wird erneut auf Freigabepflicht geprüft |
| Historie | Alte Version bleibt inhaltlich unverändert; Lesbarkeit über alten Link: PO (Kap. 15) |

---

## 7. E. Annahme (dokumentierter Kundenwille)

### Verbindliche Lesart

Die Annahme ist **interne Dokumentation des Kundenwillens**, kein Ersatz für den externen BestPay-Vertragsabschluss.

### Kunde bestätigt mindestens

1. Angebot geprüft  
2. Konditionen verstanden  
3. Annahme beabsichtigt  

### 1B-Grenzen

- Keine Pflicht zur qualifizierten elektronischen Signatur
- Keine Behauptung eines bereits abgeschlossenen BestPay-Vertrags
- Gesperrte / nicht freigegebene / widerrufene Versionen können **nicht** angenommen werden
- Annahme bezieht sich auf exakt eine Angebotsversion
- Nach Annahme: interner Workflow-Status wie bestehend (`accepted` o. ä.) + Übergang in Handoff-Vorbereitung

### Erfassungsdaten (Minimum)

- Name des Bestätigenden (Freitext)
- Zeitstempel
- Angebotsversion
- Bestätigungsflags (die drei Punkte oben)
- Optional je PO: einfache gezeichnete Signatur (Kap. 15) – **nicht** als BestPay-Vertragssignatur verkaufen

---

## 8. F. Freigabe

**Bestehende Approval-Logik bleibt alleinige Wahrheit.** Keine zweite Freigabewelt.

| Regel | Detail |
|-------|--------|
| Standardangebot | Kann nach Freigabe-/Versandregeln bereitgestellt werden |
| Standardabweichung | Muss vor Kundenvorlage freigegeben sein |
| Neue relevante Version | Freigabe wird neu geprüft (wie bestehender Workflow) |
| Kunde | Sieht keine internen Freigabedetails |
| Sperre | Nicht freigegebene / gesperrte Version: kein Share, keine Annahme |

Bereitstellungsfähige Zustände orientieren sich am bestehenden `OfferWorkflow` (z. B. freigegeben / versandbereit / versendet) – Umsetzung erweitert den Workflow, ersetzt ihn nicht.

---

## 9. G. Übergabe an BestPay (Handoff)

### Voraussetzungen

- Annahme dokumentiert
- Notwendige Kundendaten für die externe Einreichung intern als vollständig markiert
- Kein interner Vertragsschluss

### Interner Handoff-Status

| Status | Bedeutung |
|--------|-----------|
| `handoff_prepared` | Übergabe vorbereitet |
| `externally_submitted` | Extern eingereicht |
| `bestpay_inquiry` | Rückfrage von BestPay |
| `externally_completed` | Extern abgeschlossen |
| `externally_rejected` | Extern abgelehnt |
| `cancelled` | Storniert |

### Daten

- Verknüpfung zu Lead, Offer, OfferVersion, Acceptance
- BestPay-Referenz: zunächst **optional** geplant; Pflicht ab Status „extern eingereicht“ nur bei PO-Entscheidung (Kap. 15)
- Zeitstempel / bearbeitender User
- Kurze Notiz (kein Freitext-Monster)

Activity/Timeline: bestehende System-Activities (u. a. `bestpay_handoff`) nutzen/erweitern – keine zweite Historie.

---

## 10. H. Benachrichtigungen

**Bestehende Arbeitsplatz-/Activity-/Task-Logik verwenden.** Keine allgemeine Notification-Plattform.

### Intern (Admin / Außendienst)

- Kunde hat Rückfrage  
- Kunde wünscht Änderung  
- Kunde hat Angebot angenommen  
- Share-Link abgelaufen  
- Externe BestPay-Rückfrage  
- Externer Abschluss dokumentiert  

Umsetzung: System-Activity + ggf. automatische Task / Arbeitsplatz-Hinweis (idempotent per `sourceKey`).

### Kunde (über denselben Share-Kanal / erneuten Link-Hinweis)

- Angebot bereitgestellt  
- Neue Version verfügbar  
- Antwort auf Rückfrage  
- Link widerrufen/abgelaufen  

Kein separates Kunden-Inbox-Produkt in 1B.

---

## 11. I. Rollen und Rechte

| Aktion | Admin | Außendienst | Öffentlicher Share |
|--------|-------|-------------|--------------------|
| Share-Links sehen | alle | eigene/zugeordnete | — |
| Share erzeugen | ja | ja, wenn Angebot freigegeben & Zugriff | — |
| Widerrufen | ja | eigene/zugeordnete | — |
| Rückfragen sehen/antworten | ja | eigene/zugeordnete | nur eigene Fragen stellen |
| Änderungswünsche bearbeiten | ja | eigene/zugeordnete | Wunsch melden |
| Annahme sehen | ja | eigene/zugeordnete | eigene Annahme ausführen |
| Handoff verwalten | ja | eigene/zugeordnete dokumentieren | — |
| Andere Kundendaten | ja | nur zugewiesen | **nie** |
| Interne Daten | ja | ja (intern) | **nie** |
| Historische Version mutieren | nein | nein | nein |

Deaktivierte Benutzer: kein Zugriff (bestehende `is_active_user`-Regel).

---

## 12. J. Datenmodell (nur Planung – keine Migration in diesem Schritt)

Keine generische Portal- oder Chat-Datenbank. Fachliche Entitäten (Namen vorläufig):

| Entität | Zweck |
|---------|--------|
| `offer_share_links` | Token-Hash, Offer, Version, Ablauf, Widerruf, Ersteller |
| `offer_customer_questions` | Rückfrage je Version inkl. dokumentierter Antwort (keine Chat-DB) |
| `offer_change_requests` | Änderungswünsche + Status |
| `offer_customer_acceptances` | Dokumentierte Annahme je Version |
| `bestpay_handoffs` | Handoff-Status, optionale BestPay-Referenz, Notiz |

Zugriffsaudit und Timeline über bestehendes Audit / `SalesActivity` – keine Parallelhistorie.

### Beziehungen

- Alles hängt an `leadId` / `offerId` / `offerVersionId`
- Share → genau eine Version
- Annahme → genau eine Version
- Handoff → Acceptance + Offer (+ Version)

### Abgrenzung zu 1.0

- `Offer` / `OfferVersion` / `OfferWorkflow` bleiben Anker
- Keine Duplikation von Preis-/Positionsdaten für den Kundenkanal – Lesemodell aus Version/Snapshot/PDF

---

## 13. K. UI (nur Struktur)

### Intern

| Ort | Inhalt |
|-----|--------|
| **Angebot** `/offers/:id` | Bereich „Kundenvorlage“: Link erzeugen/kopieren, Ablauf, widerrufen, Status, Version |
| **Kundenakte** `/leads/:id` | Rückfragen, Änderungswünsche, Annahme-Hinweis, Handoff-Status (keine zweite CRM-Welt) |
| **Arbeitsplatz** `/sales` | Handlungsrelevante Hinweise (wie Kap. 10) |

Keine neue Hauptnavigation „Kundenportal“.

### Extern

| Ort | Inhalt |
|-----|--------|
| Eine schlanke Angebotsseite (Token-Route) | Kundenansicht Kap. 4; Aktionen: Rückfrage, Änderungswunsch, Annahme |
| Mobile zuerst | Kein Portal-Menü, keine Registrierung im MVP |

---

## 14. L. Sicherheit

| Maßnahme | Regel |
|----------|--------|
| Token | Zufällig, ausreichend Entropie; nur gehasht speichern |
| Ablauf / Widerruf | Pflicht bzw. sofort wirksam |
| Rate Limiting | Gegen Brute-Force und Spam |
| Version | Nur freigegebene, gebundene Version |
| Endpunkte | Öffentliche Zugriffe nur über eng begrenzte serverseitige Endpunkte |
| Browser | Keine Service-Role im Client |
| URL/Logs | Keine personenbezogenen Daten in URL oder Klartext-Logs |
| Audit | Zugriffsaudit (Erfolg/Fehlschlag) |
| Isolation | Keine Fremdkundendaten über Token |

---

## 15. Offene Product-Owner-Entscheidungen

Nur diese fünf Punkte – keine technischen Detailfragen:

1. **Standardlaufzeit** eines Share-Links (wie viele Tage)?  
2. **Annahme:** nur Name + Checkboxen + Zeitstempel **oder** zusätzlich einfache gezeichnete Bestätigung (weiterhin kein BestPay-Vertrag)?  
3. Darf der Kunde **nach Annahme** noch Rückfragen stellen?  
4. Bleibt eine **alte Version** nach Veröffentlichung einer neuen Version über ihren Link lesbar?  
5. Ist die **BestPay-Referenz** beim Status „extern eingereicht“ Pflicht?  

---

## 16. M. Tests (fachlich)

| Fall | Erwartung |
|------|-----------|
| Gültiger Link | Kundenansicht der gebundenen Version |
| Falscher Link / Token | Kein Zugriff, kein Leak |
| Abgelaufen | Kein Zugriff, klarer Hinweis |
| Widerrufen | Kein Zugriff |
| Nicht freigegebene Version | Bereitstellung und Annahme blockiert |
| Neue Version | Inhalt der alten Version unverändert; Lesbarkeit alter Links laut PO |
| Rückfrage und Antwort | Versionstreu, intern in Akte/Angebot, Antwort dokumentiert |
| Änderungswunsch | Status offen→erledigt, keine Auto-Mutation, neue Version bei Bedarf |
| Annahme | Name + Checkboxen (+ optional Signatur laut PO); kein BestPay-Vertragsclaim |
| Keine internen Daten sichtbar | Provision, Freigabe, Notizen, Audit ausgeblendet |
| Keine Fremdkundendaten | Isolation |
| BestPay-Handoff | Statusübergänge inkl. abgelehnt/storniert |
| Idempotenz | Doppelklicks erzeugen keine Doppelwahrheit |
| Mobile Ansicht | Nutzbar ohne Portal-Menü |

---

## 17. Definition of Done (Phase 1B)

Ausgerichtet an Produktleitlinien Kap. 5 und 9:

- [ ] Fachkonzept freigegeben (dieses Dokument)
- [ ] Offene PO-Entscheidungen (Kap. 15) entschieden
- [ ] Datenmodell freigegeben
- [ ] UI-Aufbau freigegeben
- [ ] Workflows freigegeben
- [ ] Rollen geprüft
- [ ] Tests definiert
- [ ] Umsetzung fertig *(erst nach Freigabe)*
- [ ] Tests grün
- [ ] Smoke-Test erfolgreich
- [ ] Dokumentation aktualisiert
- [ ] Commit
- [ ] Deployment
- [ ] Fachliche Abnahme

**Aktueller Stand:** Nur das Fachkonzept liegt vor. **Keine Implementierung, keine Migration, kein Commit** in diesem Schritt.

---

## Anhang – Leitlinien-Check

| Prüfung | Ergebnis |
|---------|----------|
| Passt zur Produktvision? | Ja – interner BestPay-Vertrieb, Abschluss extern |
| Zweiter Workflow? | Nein – erweitert Kap. 4 |
| Zweite Datenquelle? | Nein – Offer/Version bleiben Anker |
| Doppelte Pflege? | Nein – Share liest Version; keine Parallelpreise |
| Goldene Regeln? | Ein Prozess, eine Angebotswahrheit, eine Bedienlogik |
| Nutzen Kunde/AD/Admin? | Ja |
| Arbeit vereinfachen? | Ja – weniger Medienbruch |
| Verbotsliste? | Kein Portal-Monster, kein Vertragsgenerator, kein Multi-Anbieter |

---

## Freigabe

| Feld | Wert |
|------|------|
| Dokument | `docs/fachkonzepte/Phase-1B-Digitaler-Vertriebsprozess.md` |
| PO-Freigabe Implementierung | **Ausstehend** |
| Nächster Schritt nach Freigabe | PO-Entscheidungen Kap. 15 → Umsetzung in Blöcken gemäß Arbeitsweise |

---

*Ende Fachkonzept Phase 1B – Digitaler Vertriebsprozess.*
