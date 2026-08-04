# AMRtech Payment – UI-System (Ziel)

**Stand:** August 2026  
**Status:** Konzept (noch nicht implementiert)

---

## 1. Prinzipien

1. **Ein Control, ein Pattern** – keine Feature-spezifischen Duplikate
2. **Mobile-first** – Desktop ist Erweiterung, nicht Ausgangspunkt
3. **Token-basiert** – keine Hardcoded-Hex in Feature-CSS
4. **Touch-tauglich** – mindestens `--touch-target` (44px) für alle Aktionen
5. **Fachliche Texte** – technische Status nur für Admin optional

---

## 2. Design Tokens

### Basis (bestehend, erweitern)

Datei: `src/styles/tokens.css` (Migration aus `variables.css`)

| Kategorie | Tokens | Ergänzungen nötig |
|-----------|--------|-------------------|
| Farben | primary, accent, success, warning, danger, text, surface, border | `--color-success-light`, `--color-surface-muted`, `--color-primary-soft`, `--color-text-secondary` |
| Status | — | `--status-success-bg/text`, `--status-warning-bg/text`, `--status-danger-bg/text`, `--status-neutral-bg/text` |
| Typografie | font-family, sizes xs–2xl, weights | — |
| Spacing | space-1 … space-12 | — |
| Radius | sm, md, lg, full | — |
| Shadow | sm, md, lg | — |
| Layout | header-height, bottom-nav-height, sidebar-width, content-max-width, touch-target | safe-area-insets (APK) |

### Breakpoints (neu, zentral)

Datei: `src/styles/breakpoints.css`

| Token | Wert | Verwendung |
|-------|------|------------|
| `--bp-mobile-max` | 719px | Card-Listen, einspaltige Formulare |
| `--bp-tablet-min` | 720px | ResponsiveTable Desktop |
| `--bp-tablet-max` | 767px | — |
| `--bp-desktop-min` | 768px | Sidebar statt Bottom-Nav |
| `--bp-wide-min` | 960px | Zweispaltige Formulare, Wizard-Wide |

**Regel:** Keine Feature-Module mit eigenen Breakpoint-Werten.

---

## 3. Formulare

### Komponenten-Hierarchie

```
FormLayout (Grid, Abstände)
  └── FormField (Label + Hint + Error)
        └── FormControl (Input/Select/Textarea)
        └── CurrencyInput / NumberInput / PercentageInput
        └── CheckboxField
```

### Verbindliche Regeln

| Aspekt | Regel |
|--------|-------|
| Label | Immer sichtbar, `htmlFor`/`id` verknüpft |
| Höhe | Einheitlich via `--control-height` (z. B. 2.75rem) |
| Radius | `--radius-md` |
| Fokus | `:focus-visible` Ring (bestehend in global.css) |
| Fehler | Rote Border + Text unter Feld, Werte bleiben |
| Disabled | Opacity 0.7, cursor not-allowed |
| Select | Optisch identisch zu Input (FormControl Custom-Select) |
| Textarea | `FormField` + `textareaClassName()` |
| Checkbox | `CheckboxField`, keine rohen `<input type="checkbox">` |

### Layout

| Viewport | Formular-Grid |
|----------|---------------|
| ≤719px | 1 Spalte |
| 720–959px | 1–2 Spalten (auto-fit min 16rem) |
| ≥960px | max. 2 Spalten für verwandte Felder |

**Verboten:** Leere Eingabefelder als Platzhalter neben Aktionen. Aktionen stehen **unter** oder **in** Toolbar, nie als „Button neben leerem Feld“.

---

## 4. Buttons

### Komponente: `Button`

Datei: `src/components/ui/Button.tsx`

| Variante | Verwendung | Styling |
|----------|------------|---------|
| `primary` | Eine Hauptaktion pro Bereich | Gefüllt, primary color |
| `secondary` | Sekundär (Zurück, Abbrechen) | Outline |
| `destructive` | Löschen, Stornieren | danger color |
| `ghost` | Textaktion, Link-Ersatz | Transparent |

| Prop | Regel |
|------|-------|
| `size` | `default` (touch-target), `compact` (nur Desktop-Tabellen) |
| `loading` | Spinner + disabled |
| `disabled` | Visuell + `aria-disabled` |

### Platzierung

- **Pro Seitenabschnitt max. 1 Primary-Button**
- Sekundäraktionen in `ButtonGroup` (flex-wrap)
- Kein `<Link styled as button>` – `Button asChild` mit Router-Link
- Toolbar: `flex-wrap`, gap `--space-3`, immer innerhalb Container

**Migration:** Alle `.primaryAction`, `.secondaryAction`, `.dangerAction` in Feature-CSS → `Button`-Komponente.

---

## 5. Dialoge

### ConfirmDialog (bestehend, beibehalten)

- Bestätigung ohne Felder
- Fokus auf Abbrechen (bestehend)
- Mobile: max-width 100%, Padding Safe Area

### Modal (neu)

Datei: `src/components/ui/Modal.tsx`

- Formular-Dialoge (Freigabe, Sonderzahlung, Kürzung)
- Backdrop + Escape schließt
- Titel + Body + Footer (Primary + Secondary)
- Mobile: Vollbreite, Bottom-Sheet-Option für ≤719px
- Keine verschachtelten Modals

**Migration:** `OfferWorkflowSection` Inline-Panels → Modal; `ActivationDetailPage` Ad-hoc-Dialog → Modal.

---

## 6. Status

### StatusBadge (neu, generisch)

Datei: `src/components/ui/StatusBadge.tsx`

```typescript
variant: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
label: string          // fachlicher Text
technicalLabel?: string // nur Admin, optional
```

Domain-Badges (`OfferWorkflowStatusBadge`, etc.) werden **Thin-Wrapper** mit Label-Mapping.

| Ist | Ziel |
|-----|------|
| 8+ Badge-Komponenten | 1 Primitive + Domain-Mapper |
| Hardcoded Hex | Status-Tokens |
| `data-group` CSS | `variant` Prop |

---

## 7. Tabellen und Listen

### ResponsiveTable (bestehend, ausbauen)

| Modus | Verwendung |
|-------|------------|
| `cards` (default) | Verwaltungslisten, >5 Spalten |
| `scroll` | Vergleichstabellen, ≤5 Spalten |

Regeln:
- Aktionsbuttons in `renderActions` → immer in Card-Footer (mobile)
- Spaltenlabels auf Mobile sichtbar
- Lange Texte: `overflow-wrap: anywhere`
- Beträge: `white-space: nowrap` (nur Wert, nicht ganze Zeile)

### DataList (neu)

Datei: `src/components/data/DataList.tsx`

- Card-Pattern aus ActivationsPage/LeadsPage extrahieren
- `<DataList items={…} renderItem={…} />`
- Für: Leads, Offers, Contracts, Activations, AdviceHub-Sessions

### Entscheidungsmatrix

| Listen-Typ | Komponente |
|------------|------------|
| Kunden, Angebote, Verträge, Aktivierungen | DataList (Cards) |
| Admin-Tabellen (>5 Spalten) | ResponsiveTable (cards) |
| Vergleich/Diff (≤5 Spalten) | ResponsiveTable (scroll) |
| Inline-Editing (Users) | Modal-Edit statt Tabellen-Inline |

---

## 8. Seiten-Layout

### AppShell (bestehend, verfeinern)

```
Header (fix)
├── SidebarNavigation (≥768px)
└── main
    ├── PageHeader (Titel + Beschreibung + max. 1 Primary)
    ├── Content
    └── (kein Footer-Button-Chaos)
BottomNavigation (≤767px)
```

### PageHeader (bestehend, verbindlich)

| Element | Regel |
|---------|-------|
| Titel | Genau einer, h1 |
| Beschreibung | Ein Satz, optional |
| Actions | Max. 1 Primary + Sekundär-Gruppe |

---

## 9. Responsive / APK

### Breakpoint-Verhalten

| Viewport | Navigation | Formulare | Tabellen | Dialoge |
|----------|------------|-----------|----------|---------|
| 360px | Bottom-Nav | 1 Spalte | Cards | Full-width |
| 390px | Bottom-Nav | 1 Spalte | Cards | Full-width |
| 412px | Bottom-Nav | 1 Spalte | Cards | Full-width |
| 768px | Sidebar | 1–2 Spalten | Table/Cards | Centered |
| Desktop | Sidebar | 2 Spalten | Table | Centered |

### APK-spezifisch (kein separates CSS)

- `viewport-fit=cover` + Safe Area Padding in AppShell
- Keine feste `min-width` auf Body/Main
- Kein globales `overflow-x: hidden` auf Content
- Capacitor nutzt identischen `dist/`-Build

---

## 10. Fehler- und Erfolgsdarstellung

| Kanal | Verwendung |
|-------|------------|
| Toast | Speichern, Netzwerk, schnelle Bestätigung |
| Inline (FormField) | Validierung pro Feld |
| `role="status"` | Schritt-Zusammenfassung, nicht-blockierend |
| `role="alert"` | Blockierende Fehler |
| EmptyState | Leere Listen mit einer Aktion |

---

## 11. Migrations-Reihenfolge UI-System

1. `tokens.css` + `breakpoints.css` erweitern
2. `Button` + `StatusBadge` + `Modal` implementieren
3. `ResponsiveTable` auf alle Admin-Tabellen
4. `DataList` für Vertriebslisten (optional, bereits gut)
5. Feature-CSS `.primaryAction` etc. entfernen
6. Domain-Badges auf Thin-Wrapper umstellen
7. Wizard/CRM auf neues Form-Layout

---

## 12. Nicht-Ziele

- Kein neues Farbschema / Rebranding
- Keine neue Icon-Library
- Kein CSS-in-JS
- Keine separate APK-UI
- Kein Component-Library-Wechsel (kein MUI/Chakra)
