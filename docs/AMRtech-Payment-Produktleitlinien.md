# AMRtech Payment – Produktleitlinien

**Status:** Verbindlich ab Version 1.1 · **fachlich freigegeben**  
**Geltung:** Jede Entwicklung, jedes Fachkonzept, jedes Review  
**Stand:** 2026-08-02 (Finalisierung nach Product-Owner-Freigabe)  
**Bezug:** Gold Master `v1.0.0`

Diese Dokumentation ist die verbindliche Grundlage für alle Arbeiten ab Version 1.1. Abweichungen sind nur nach einer bewussten, dokumentierten Produktentscheidung zulässig.

---

## Die fünf goldenen Regeln

Diese Regeln besitzen **Vorrang vor späteren Detailentscheidungen**.

1. **Ein Produkt – ein Zweck.**
2. **Ein Prozess – eine Wahrheit.**
3. **Ein Design – eine Bedienlogik.**
4. **Ein Datensatz – eine Quelle.**
5. **Einfachheit vor Funktionsvielfalt.**

---

## 1. Produktvision

AMRtech Payment ist das interne CRM-, Beratungs- und Vertriebsportal der AMRtech UG für den Vertrieb von BestPay-Produkten.

Die Software begleitet den kompletten internen Vertriebsprozess.

Der eigentliche Vertragsabschluss erfolgt ausschließlich über die offiziellen externen BestPay-Prozesse.

Die Software ersetzt diese ausdrücklich nicht.

---

## 2. Produktgrundsätze

| Grundsatz | Bedeutung |
|-----------|-----------|
| Eine Oberfläche | Gleiche Aufgaben werden an einer Stelle erledigt – keine parallelen UIs für denselben Zweck. |
| Ein Workflow | Es gibt genau einen verbindlichen Vertriebsprozess (Kapitel 4). |
| Eine Datenwahrheit | Jede fachliche Tatsache hat genau eine maßgebliche Quelle. |
| Keine Doppelpflege | Dieselben Daten werden nicht an zwei Orten gepflegt. |
| Keine Parallelprozesse | Keine Zweitwege neben dem verbindlichen Prozess. |
| Transparenz vor Komplexität | Nachvollziehbare Defaults statt versteckter Sonderlogik. |
| Einfachheit vor Funktionsvielfalt | Weniger, dafür klare Funktionen. |
| Außendienst-Fokus | Der Außendienst soll möglichst ohne weitere Hilfsmittel (Excel, Paralleltools) arbeiten können. |
| Erkennbarer Nutzen | Jede Funktion muss einen erkennbaren Nutzen für mindestens einen dieser Bereiche besitzen: **Kunde**, **Außendienst**, **Administration**. Reine Technik ohne fachlichen Mehrwert gehört nicht in die Produkt-Roadmap. |
| Arbeit vereinfachen | Jede neue Funktion muss bestehende Arbeit vereinfachen. Erzeugt sie mehr Klicks, doppelte Pflege, einen zweiten Workflow oder eine zweite Datenwahrheit, wird sie nicht umgesetzt oder vor der Umsetzung grundlegend überarbeitet. |

---

## 3. Ausdrücklich nicht geplant

Die folgenden Themen sind verbindlich ausgeschlossen. Sie dürfen künftig nur nach einer bewussten Produktentscheidung aufgenommen werden:

- Multi-Anbieter
- Vergleichsportal (Marktplatz / mehrere Payment-Anbieter wählbar)
- Payment-Marktplatz
- ERP
- Buchhaltung
- DATEV
- eigener Vertragsgenerator
- eigene Paymentplattform
- White-Label-Lösung
- zweite CRM-Welt
- zweite Angebotswelt
- zweite Vertragswelt

**Hinweis zu „Vergleich“ im Vertriebsprozess (Kapitel 4):**  
Gemeint ist ausschließlich der interne Beratungsvergleich (Ist-Situation des Kunden gegenüber BestPay-Optionen / Empfehlung). Das ist kein Multi-Anbieter-Vergleichsportal und kein Wechselprodukt zwischen Payment-Unternehmen.

---

## 4. Der verbindliche Vertriebsprozess

Jeder künftige Funktionsblock muss genau diesen Prozess unterstützen und darf keinen zweiten Prozess erzeugen:

```
Lead
  ↓
Kunde
  ↓
Beratung
  ↓
Bedarf
  ↓
Vergleich
  ↓
Empfehlung
  ↓
Angebot
  ↓
interne Freigabe
  ↓
Kunde prüft
  ↓
Annahme
  ↓
Übergabe an BestPay
  ↓
Aktivierung
  ↓
Provision
```

### Verbindliche Lesarten

| Schritt | Bedeutung in AMRtech Payment |
|---------|------------------------------|
| Lead / Kunde | Interne Erfassung und Kundenakte |
| Beratung / Bedarf | Verkaufsleitfaden und Bedarfsaufnahme |
| Vergleich | Ist-Situation vs. BestPay-Optionen (kein Multi-Anbieter-Portal) |
| Empfehlung | Interne BestPay-Empfehlung |
| Angebot | Internes BestPay-Angebot inkl. Versionierung |
| Interne Freigabe | Bestehender Freigabe-Workflow |
| Kunde prüft / Annahme | Kundenkanal zur Prüfung und digitalen Angebotsannahme |
| Übergabe an BestPay | Dokumentation der Übergabe an den externen BestPay-Vertragsabschluss |
| Aktivierung / Provision | Interne Status- und Provisionsführung nach dem verbindlichen Modell |

Der BestPay-Vertragsabschluss selbst liegt außerhalb dieser Software.

---

## 5. Definition of Done

Jeder größere Entwicklungsblock gilt erst als abgeschlossen, wenn alle Punkte erfüllt sind:

- [ ] Fachkonzept freigegeben
- [ ] Datenmodell freigegeben
- [ ] UI freigegeben
- [ ] Workflow freigegeben
- [ ] Rollen geprüft
- [ ] Tests definiert
- [ ] Umsetzung fertig
- [ ] Tests grün
- [ ] Smoke-Test erfolgreich
- [ ] Dokumentation aktualisiert
- [ ] Commit
- [ ] Deployment
- [ ] Fachliche Abnahme

Ohne diese Kette kein „fertig“ und kein Release-Anspruch für den Block.

---

## 6. Architekturregeln

- Keine zweite Wahrheit
- Keine doppelten Services für dieselbe Fachlichkeit
- Keine parallelen Statusmodelle
- Keine doppelte Navigation für denselben Zweck
- Keine Feature-Duplikate
- Bestehende Komponenten wiederverwenden
- Bestehende Workflows erweitern statt neue einzuführen
- Supabase bleibt die operative Datenquelle
- LocalStorage ausschließlich für transiente UI-Einstellungen und Entwürfe

**Übergangshinweis zu Version 1.0:**  
In `v1.0.0` liegen Teile der Operativdaten noch lokal. Ab 1.1 gilt für Neuentwicklung und Migrationen die Regel „Supabase = operative Wahrheit“. Bestehende Hybridzustände werden abgebaut, nicht ausgebaut.

---

## 7. UI-Grundsätze

- Ein FormControl
- Ein Designsystem
- Ein Dialogsystem
- Ein Buttonsystem
- Ein Statussystem
- Mobile zuerst
- Desktop erweitert nur sinnvoll
- Keine unterschiedlichen Designs für gleiche Bedienelemente

---

## 8. Roadmap 1.1

Die inhaltliche Planung von Version 1.1 ist die **Roadmap 1.1** (Planungsartefakt nach Produktentscheidung BestPay / interner Vertrieb).

Diese Leitlinien sind die verbindliche Norm. Die Roadmap darf ihnen nicht widersprechen und muss bei Konflikten angepasst werden – nicht umgekehrt.

Die Roadmap wird hier **nicht** kopiert. Sie ist unter der aktuellen Planungsfassung (Cursor-Canvas `roadmap-1-1`) zu führen und bei Freigabe ggf. zusätzlich im Repository zu verankern.

Phasenrahmen der Roadmap 1.1 (nur Verweis, keine Detailkopie):

1. CRM  
2. Digitaler Vertriebsprozess (inkl. Übergabe an BestPay)  
3. Unternehmenssteuerung  
4. Kundenservice  

---

## 9. Arbeitsweise ab Version 1.1

Für jeden Entwicklungsblock gilt künftig:

1. Produktleitlinien prüfen  
2. Roadmap prüfen  
3. Fachkonzept erstellen  
4. Product-Owner-Freigabe  
5. Implementierung  
6. Tests  
7. Deployment  
8. Abnahme  

**Eine Implementierung darf niemals vor einer fachlichen Freigabe beginnen.**

---

## 10. Regeln für Cursor / Composer

Vor jeder Implementierung muss geprüft werden:

- Passt die Änderung zur Produktvision?
- Entsteht ein zweiter Workflow?
- Entsteht eine zweite Datenquelle?
- Entsteht doppelte Pflege?
- Verletzt die Änderung eine der fünf goldenen Regeln?

**Falls ja:** nicht implementieren. Den Konflikt stattdessen dokumentieren.

Zusätzlich gelten Kapitel 2 (Nutzen für Kunde / Außendienst / Administration; Arbeit vereinfachen) und Kapitel 9 (keine Implementierung vor Product-Owner-Freigabe).

---

## Anhang A – Abgleich und Hinweise (Dokumentation)

### Roadmap 1.1 ↔ Leitlinien

| Prüffrage | Ergebnis |
|-----------|----------|
| Widerspricht die Roadmap den Leitlinien irgendwo hart? | **Nein** – Produktvision, BestPay-only, kein Eigenvertrag, ein Prozess sind ausgerichtet. |
| Verweist die Roadmap auf `docs/AMRtech-Payment-Produktleitlinien.md`? | **Nein** (Stand Prüfung Finalisierung) – nur dokumentiert, nicht automatisch geändert. |
| Doppelte Prozesse in der Roadmap? | **Nein** |
| Scope-Drift-Risiken / Mehrdeutigkeiten? | Siehe unten |

### Dokumentierte Spannungen / Mehrdeutigkeiten

1. **Begriff „Vergleich“** – Prozessschritt (Ist vs. BestPay), kein Multi-Anbieter-Portal.  
2. **Prozesskette gekürzt in der Roadmap-Kurzform** – Bedarf / Vergleich / Empfehlung oft nicht genannt; an Kapitel 4 angleichen empfohlen.  
3. **Persistenz 1.0 vs. Architekturregel** – Hybrid in `v1.0.0`; ab 1.1 keine neuen LocalStorage-Wahrheiten.  
4. **Begriff „Vertrag“ in Code/UI 1.0** – Statusnachverfolgung nach BestPay-Übergabe erlaubt; kein eigener Vertragsgenerator / keine Parallel-Vertragswelt.

### README-Hinweis (nur dokumentiert, nicht geändert)

Die Datei `README.md` stimmt **nicht** mit Kapitel 1 überein:

- Einstieg beschreibt eine „Außendienst-Anwendung zur Aufnahme von Payment-Leads und zum Vergleich …“, nicht das interne CRM-/Beratungs-/Vertriebsportal der AMRtech UG laut Produktvision.
- Abschnitt „C: Vertragsmanagement“ beschreibt Verträge als laufende Konditionswahrheit aus angenommenen Angeboten – Spannungsfeld zur Leitlinie „kein eigener Vertragsgenerator / keine zweite Vertragswelt“ und „Abschluss nur über externe BestPay-Prozesse“.

**Empfehlung:** README bei nächster bewusster Doc-Pflege an Kapitel 1 und den verbindlichen Prozess angleichen (keine automatische Änderung in diesem Schritt).

### Roadmap-Hinweis (nur dokumentiert, nicht geändert)

Die Planungs-Roadmap (Canvas `roadmap-1-1`) verweist **nicht** auf `docs/AMRtech-Payment-Produktleitlinien.md`.

**Empfehlung:** Expliziten Verweis ergänzen und Kurzprozess an Kapitel 4 angleichen (keine automatische Änderung in diesem Schritt).

### Empfohlene Folgekorrekturen (Planung/Doku)

- Roadmap: Verweis auf diese Datei + Prozesszeile vollständig  
- README: Produktvision und Abgrenzung BestPay-Abschluss  
- Je Entwicklungsblock: Kapitel 9 + DoD (Kapitel 5)

### Freigabestatus dieses Dokuments

| Feld | Wert |
|------|------|
| Inhalt finalisiert | Ja |
| Verbindlichkeit ab 1.1 | Ja |
| Formelle Fach-Freigabe durch Product Owner | **Erteilt** (Finalisierung 2026-08-02) |
| Fünf goldene Regeln | Verbindlich, Vorrang |
| Arbeitsweise & Cursor-Regeln | Verbindlich |

---

*Ende der Produktleitlinien.*
