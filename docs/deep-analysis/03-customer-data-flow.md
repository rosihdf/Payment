# 03 – Kunden-Datenfluss, Schema und Datenqualität

Nur Ist-Zustand. Keine Datenänderung, keine Migration.

## 3.1 Kette UI → Hook/State → Service → Repository → Supabase → RLS

```
LeadsPage / WorkspacePage / LeadRecordPage
  → useCurrentUser (CurrentUserProvider → userService.getCurrentUser)
  → leadService / salesWorkspaceService
  → LeadRepository (Interface)
      ├─ LocalLeadRepository  → localStorage        (dataMode=local, alle Tests)
      └─ SupabaseLeadRepository → Tabelle leads     (dataMode=supabase, Produktion)
  → RLS-Policies auf leads
```

Repository-Auswahl: `src/repositories/createCoreRepositories.ts:22-38`. Demo-Seed nur bei `local`: `ServicesProvider.tsx:17-19`.

## 3.2 Führende Tabelle und Betreuerfeld

| Ebene | Feldname | Beleg |
|---|---|---|
| Führende Tabelle | `public.leads` | einzige Kundentabelle, 3 Zeilen |
| Domain | `Lead.assignedSalesUserId: string` | `src/domain/lead/lead.ts:53` |
| Domain | `Lead.createdByUserId: string` | `src/domain/lead/lead.ts:54` |
| DB-Spalte | `assigned_sales_user_id text NOT NULL` | `information_schema.columns` |
| DB-Spalte | `created_by_user_id text NOT NULL` | `information_schema.columns` |
| Nutzlast | `data jsonb NOT NULL` – vollständiges Lead-Objekt redundant zu den Spalten | `SupabaseLeadRepository.ts:18-29` |

**Nicht** für den Kundenbetreuer verwendet, obwohl namensähnlich:

| Feld | tatsächliche Bedeutung | Beleg |
|---|---|---|
| `owner_user_id` | Verträge | `SupabaseContractRepository.ts:20,35` |
| `salesRepresentativeId` | Provisionsdomäne | `commission_assignments.data->>'salesRepresentativeId'` |
| `sales_team_id` | Benutzerprofil, **nicht** Lead | `profiles.sales_team_id` |

## 3.3 Benutzerbezug – welche ID gilt

| Verwendung | ID-Quelle | Typ | Beleg |
|---|---|---|---|
| `User.id` (Supabase) | `profiles.user_id` = `auth.users.id` | **uuid** | `mapProfile.ts:19-20`, `SupabaseUserRepository.ts:48` |
| `leads.assigned_sales_user_id` | Wert von `currentUser.id` | **text** | `leadService.ts:143-144` |
| RLS-Vergleich | `auth.uid()::text` gegen Text-Spalte | Cast | `leads_select_policy` |
| Demo-/Local-Modus | `user_001`, `user_002`, … | text | `adminStorageMigration.ts:85-161` |

**Belegte Typmischung:** `profiles.user_id` ist `uuid`, `leads.assigned_sales_user_id` ist `text`. Der Abgleich funktioniert nur, weil RLS explizit `auth.uid()::text` castet und weil der Client bei `createLead` echte UUID-Strings schreibt. Es gibt **keinen Foreign Key** von `leads.assigned_sales_user_id` auf `profiles.user_id` – verwaiste Betreuer sind schemaseitig zulässig.

**Belegte Demo-ID-Kontamination im Produktionscode:**

```133:135:src/domain/lead/normalizeLead.ts
  const assignedSalesUserId =
    asString(data.assignedSalesUserId) || DEMO_LEAD_ASSIGNMENTS[id] || 'user_001';
  const createdByUserId = asString(data.createdByUserId) || assignedSalesUserId;
```

Dieser Fallback läuft **in jedem Datenmodus**. Fehlt `assignedSalesUserId` im JSONB, wird die Demo-ID `user_001` gesetzt – ein Wert, der niemals einer `auth.uid()` entspricht. Der Kunde wäre dann per RLS sichtbar (Spalte gefüllt), im Client aber niemandem zugeordnet.

E-Mail wird für die Zuordnung **nicht** verwendet, nur zur Anzeige (`profiles.email`, `normalizeUser.ts:50-53`).

## 3.4 Vergleichsmatrix aller Queries und Filter

| Ansicht | Service-Methode | Repository-Query | Client-Filterbedingung | RLS-Bedingung | verwendete ID | Rollenlogik |
|---|---|---|---|---|---|---|
| **Kundenliste** `/leads` | `leadService.searchLeads(q, ctx)` | `getAll()` → `select *` auf `leads` | admin: keine; field_service: **`lead.assignedSalesUserId === ctx.userId`** (`leadService.ts:218-224`) + Textsuche (`104-128`) | `is_admin() OR assigned_sales_user_id = auth.uid()::text OR created_by_user_id = auth.uid()::text` | `currentUser.id` | harte Rollenprüfung |
| **Arbeitsplatz „Meine Kunden"** `/sales` | `salesWorkspaceService.getWorkspaceView(ctx,{scope:'mine'})` | `getAll()` auf leads, offers, sessions, tasks, activities | Lead: **`assignedSalesUserId === userId` OR `createdByUserId === userId`** (`salesWorkspaceService.ts:182-187`); Offer/Session: `createdByUserId`; Tasks: assignee OR creator OR sichtbarer Lead | wie oben je Tabelle | `context.userId` | Nicht-Admins werden auf `mine` gezwungen (`297-299`) |
| **Arbeitsplatz „Team"** | `getWorkspaceView(ctx,{scope:'team'})` | `getAll()` | **kein** User-Filter → alle Datensätze | admin sieht alles | – | nur `role === 'admin'` (`174-176`) |
| **Beratungs-Kundenauswahl** | `leadService.getVisibleLeads(ctx)` | `getAll()` | identisch zur Kundenliste | wie oben | `currentUser.id` | wie Kundenliste |
| **Kundenakte** `/leads/:id` | `leadService.getLeadById(id)` | `select * where id = ?` | **keiner** | SELECT-Policy | – | Edit-Gate `canUserEditLead` |
| **Kunde anlegen** | `leadService.createLead(input, userId)` | INSERT | setzt `assignedSalesUserId = userId`, `createdByUserId = userId` (`leadService.ts:139-148`) | `is_admin() OR (created_by = auth.uid()::text AND assigned = auth.uid()::text)` | `currentUser.id` (`NewLeadPage.tsx:64`) | – |
| **Kunde bearbeiten** | `leadService.updateLead(id, input, ctx)` | UPDATE | Betreuer wird **unverändert übernommen** (`leadService.ts:194-204`) | admin OR assigned OR created | `context.userId` | `canUserEditLead` (`79-86`) |

### Belegte Filterabweichung

| Fall | Kundenliste | Arbeitsplatz | RLS |
|---|---|---|---|
| Außendienst ist Betreuer | sichtbar | sichtbar | sichtbar |
| Außendienst hat angelegt, ist aber **nicht** Betreuer | **unsichtbar** | sichtbar | sichtbar |
| Admin | alle | scope-abhängig | alle |

Die Kundenliste ist strenger als RLS und strenger als der Arbeitsplatz. Das ist eine der beiden Ursachen für „Kunden erscheinen in einer Ansicht, in einer anderen nicht".

### Zweite, gewichtigere Ursache

`/sales` rendert **ausschließlich** `view.dayWork` mit den vier Abschnitten Überfällig, Heute, Blockiert, Nächste Kundenfälle (`src/v2/workspace/WorkspacePage.tsx:116-136`). Die Einträge stammen aus `buildSalesDayWorkspaceSections` und setzen offene Aufgaben mit Fälligkeitsdatum bzw. Karten mit `primaryKind`/`isHardBlocked` voraus (`src/services/salesDayWorkspace.ts:108-237`).

Produktionsdaten: `sales_tasks` hat **0 Zeilen**. Damit sind Überfällig/Heute strukturell immer leer, und Kunden erscheinen nur, wenn sie über `nextCases`-Karten qualifizieren. Ein neu angelegter Kunde ohne Aufgabe erscheint auf dem Startbildschirm **nie** – unabhängig von der Betreuerzuordnung.

Zusätzlich: das Suchfeld auf `/sales` (`WorkspacePage.tsx:92-98`) übergibt `query` an den Service, der daraus `searchHits` erzeugt (`salesWorkspaceService.ts:613-665`). Diese `searchHits` werden **nie gerendert**. Die Suche hat sichtbar keine Wirkung.

## 3.5 Betreuerzuordnung – Ist-Zustand

| Vorgang | Verhalten | Beleg |
|---|---|---|
| Kunde anlegen | Betreuer wird **implizit** auf den Anlegenden gesetzt | `leadService.ts:143-144`, `NewLeadPage.tsx:64` |
| Kunde bearbeiten | Betreuer wird **nicht** verändert und **nicht** angezeigt | `leadService.ts:194-204` |
| Formular | `v2/crm/LeadForm.tsx` enthält **kein** Betreuerfeld (Zeilen 84-277) | Codeprüfung |
| Mapping | `leadFormMapping.ts:3-29` mappt den Betreuer **nicht** | Codeprüfung |
| Anzeige | nur lesend in der Liste („Betreuer: …", `LeadsPage.tsx:99`) | Codeprüfung |

**Es gibt in der gesamten Anwendung keinen Weg, einen Kunden einem anderen Betreuer zuzuweisen.** Kernanforderung 2 („Kunden einem Betreuer zuweisen") ist nicht implementiert – nicht defekt, sondern nicht vorhanden.

Folge für Kernanforderung 3 („Außendienst sieht exakt seine Kunden"): Sie ist mit dem aktuellen Stand unerfüllbar, weil ein Admin nur Kunden für sich selbst anlegen kann.

## 3.6 Team-Filter – Herkunft und Bedeutung

| Aspekt | Befund | Beleg |
|---|---|---|
| Rendering | Select „Ansicht" mit „Meine Kunden"/„Team" | `WorkspacePage.tsx:99-108` |
| Sichtbarkeit | nur `currentUser.role === 'admin'` | `WorkspacePage.tsx:99` |
| Berechtigung | `canUseTeamScope` = `role === 'admin'` | `salesWorkspaceService.ts:174-176` |
| Tatsächliche Semantik | **alle Datensätze im System**, kein Teambezug | `salesWorkspaceService.ts:183-184` |
| `sales_team_id` in DB | vorhanden auf `profiles`, aber bei **beiden** Produktionsprofilen `NULL` | SQL-Abfrage `profiles` |
| Teamtabelle | existiert **nicht** | Tabelleninventur |
| Permission `leads.view_team` | in `permission.ts:6,75` definiert, aber **nirgends ausgewertet** | Codeprüfung |

**Team ist fachlich nicht modelliert.** Der Filter ist ein Admin-Alles-Schalter mit irreführendem Namen. Das erklärt „unklarer Team-Filter" vollständig.

## 3.7 RLS gegen Clientfilter – dieselbe Wahrheit?

| Tabelle | RLS SELECT | Client | identisch |
|---|---|---|---|
| `leads` | `is_admin() OR assigned = uid OR created = uid` | admin: alle; field_service: **nur** `assigned` | **nein** |
| `leads` UPDATE | `is_admin() OR assigned = uid OR created = uid` | `canUserEditLead`: admin OR assigned OR created (`leadService.ts:79-86`) | ja |
| `leads` INSERT | `is_admin() OR (created = uid AND assigned = uid)` | setzt beide auf `userId` | ja |
| `leads` DELETE | nur `is_admin()` | kein UI-Pfad | – |

Die Leseregel ist die einzige Divergenz, aber sie ist genau die, die der Nutzer bemerkt.

Weitere clientseitige Rollenlogik (jeweils eigene Regel, nicht aus einer Quelle abgeleitet):

| Service | Bedingung | Datei:Zeile |
|---|---|---|
| `leadService.canUserEditLead` | admin OR assigned OR created | `79-86` |
| `offerService.canUserAccessLead` | admin OR assigned OR created | `73-78` |
| `offerService.canUserAccessOffer` | admin OR `offer.createdByUserId` | `81-86` |
| `salesTaskService.canViewTask` | assignee OR creator | `83-87` |
| `salesActivityService.canViewActivity` | **nur** creator | `44-48` |
| `contractService.canViewContract` | Permission `contracts.view_team` | `118-121` |

Sechs Services, sechs unterschiedliche Sichtbarkeitsregeln.

## 3.8 Kundenschema – Spalten, Indizes, Constraints

### `public.leads` (3 Zeilen)

| Spalte | Typ | Null | Default |
|---|---|---|---|
| `id` | text | NO | – |
| `company_name` | text | NO | – |
| `status` | text | NO | – |
| `assigned_sales_user_id` | text | NO | – |
| `created_by_user_id` | text | NO | – |
| `data` | jsonb | NO | – |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

Constraints: `leads_pkey PRIMARY KEY (id)`. **Keine** Foreign Keys auf `profiles`. **Keine** Unique-Constraints auf Firmenname.

### `public.profiles` (2 Zeilen)

| Spalte | Typ | Null | Default |
|---|---|---|---|
| `user_id` | **uuid** | NO | – (PK, FK → `auth.users.id` ON DELETE CASCADE) |
| `display_name` | text | NO | – |
| `email` | text | NO | `''::text` |
| `role` | text | NO | – |
| `status` | text | NO | – |
| `sales_team_id` | text | YES | NULL |
| `schema_version` | integer | NO | `3` |
| `deactivated_at` | timestamptz | YES | NULL |
| `last_access_at` | timestamptz | YES | NULL |

Trigger: `profiles_privilege_guard` → `enforce_profile_privilege_guard()`.

### `public.lead_contacts` (1 Zeile)

`id`, `lead_id` (FK → `leads.id` ON DELETE CASCADE), `is_primary`, `is_active`, `created_by_user_id`, `data jsonb`, Zeitstempel.

## 3.9 Reale Datenqualität in Produktion

### Profile

| user_id | display_name | email | role | status | sales_team_id |
|---|---|---|---|---|---|
| `ef9cba97-3eb5-4b28-9fa2-98a027be42e5` | Michael Rosenau | m.rosenau@amrtech.de | **admin** | active | **NULL** |
| `35b167e8-c72d-472e-bff7-d5e6e553a5d3` | test | post@amrtech.de | **field_service** | active | **NULL** |

### Leads

| id | company_name | status | assigned_sales_user_id | Profil | created_by | JSONB konsistent |
|---|---|---|---|---|---|---|
| `lead_a27ab486-…` | AMRtech UG | new | `ef9cba97-…` | Michael Rosenau | `ef9cba97-…` | ja |
| `lead_ee2524e4-…` | **„2"** | new | `ef9cba97-…` | Michael Rosenau | `ef9cba97-…` | ja |
| `lead_test_p1b_smoke_20260802` | TEST – Phase 1B Kundenlink | offer | `ef9cba97-…` | Michael Rosenau | `ef9cba97-…` | ja |

### Befunde Datenqualität

| Befund | Bewertung |
|---|---|
| **Alle 3 Kunden gehören dem Admin.** `assigned_sales_user_id` ist bei allen drei `ef9cba97-…`. | **Kritisch.** Der Außendienst-Account `35b167e8-…` hat **null** zugeordnete Kunden. „Meine Kunden" ist für ihn korrekt leer – die App bietet aber keine Möglichkeit, das zu ändern (3.5). |
| Keine verwaisten Betreuer | positiv: alle IDs lösen auf ein existierendes Profil auf |
| Keine Nullwerte in Pflichtspalten | positiv |
| Keine doppelten Zuordnungen | positiv (1:1 pro Lead) |
| JSONB `data->>'assignedSalesUserId'` stimmt mit der Spalte überein | positiv: `normalizeLead`-Demo-Fallback hat **noch nicht** zugeschlagen |
| 1 Lead mit Firmenname `„2"` | Testmüll, keine Validierung auf Mindestlänge |
| 1 Lead ist explizit Testdatensatz (`lead_test_p1b_smoke_20260802`) | Testmüll in Produktion |
| `sales_team_id` bei beiden Profilen NULL | belegt: Team wird nicht genutzt |
| Doppelte Wahrheit Spalte ↔ JSONB | 5 Felder existieren zweimal (`id`, `company_name`, `status`, `assigned_sales_user_id`, `created_by_user_id`) und werden nur durch Anwendungscode synchron gehalten |
| Kein FK `leads.assigned_sales_user_id → profiles.user_id` | Risiko: Löschen eines Profils hinterlässt verwaiste Zuordnung ohne DB-Fehler |
| Kein Index auf `assigned_sales_user_id` | bei 3 Zeilen irrelevant, bei Wachstum relevant, da RLS darauf filtert |

### Altspalten und ungenutzte Felder

| Feld | Status |
|---|---|
| `profiles.sales_team_id` | vorhanden, nirgends fachlich ausgewertet, beide Werte NULL |
| `profiles.schema_version` | technisch, Wert 3 |
| `profiles.last_access_at` | von `mark_profile_active_on_login()` gepflegt |
| `leads.data` (JSONB) | enthält alle Spaltenwerte redundant |

## 3.10 Zusammenfassung der Ursachen

| Symptom des Nutzers | Belegte Ursache |
|---|---|
| „Kunden erscheinen in einer Ansicht, in einer anderen nicht" | 1) `/sales` rendert nur aufgaben-/fälligkeitsgetriebene `dayWork`-Abschnitte, `sales_tasks` ist leer (`WorkspacePage.tsx:116-136`, `salesDayWorkspace.ts:108-237`). 2) `/leads` filtert für field_service nur nach `assignedSalesUserId`, Arbeitsplatz und RLS zusätzlich nach `createdByUserId` (`leadService.ts:218-224` vs. `salesWorkspaceService.ts:182-187`). |
| „Betreuerzuordnung und ‚Meine Kunden' widersprechen sich" | Es gibt keine Betreuerzuweisung in der UI. Alle 3 Produktionskunden gehören dem Admin; der Außendienst-Account hat 0 Kunden. |
| „Unklarer Team-Filter" | „Team" ist ein Admin-Alles-Schalter ohne Teammodell; `sales_team_id` ist überall NULL, es gibt keine Teamtabelle. |
| „Suche wirkt nicht" (Arbeitsplatz) | `searchHits` werden berechnet, aber nicht gerendert. |
