# Rebuild Frontend v2 – Viewport- und Mobile-Nachweis

**Branch:** `rebuild/frontend-v2`  
**Stand:** Phase 7–9 abgeschlossen (ohne Push/Deploy)

## Automatisierte Viewport-Prüfung

Datei: `src/test/v2ResponsiveViewport.test.tsx`

Geprüfte Breiten: **360 · 390 · 412 · 768 · 960 · 1280 px**

Pro Breite:
- Arbeitsplatz (`/sales`) – Heading + `scrollWidth <= clientWidth`
- Kundenliste (`/leads`) – Heading + Overflow-Check

Zusätzlich bei 360 px:
- Beratungshub (`/advice`)
- Kundenakte (`/leads/lead_001`) mit Navigation „Kundenakte Bereiche“

## Screenshots

Ablage: `docs/revision/screenshots/`

| Seite | 360 | 390 | 412 | 768 | Desktop 1280 |
|-------|-----|-----|-----|-----|--------------|
| Arbeitsplatz | sales-360.png | sales-390.png | sales-412.png | sales-768.png | sales-desktop.png |
| Kundenliste | leads-*.png | … | … | … | … |
| Beratung | advice-*.png | … | … | … | … |
| Kundenakte | lead-record-*.png | … | … | … | … |
| Profil / App-Info | profile-*.png | … | … | … | … |

Erzeugt gegen lokalen Production-Preview (`vite preview`, kein Deploy).

## PWA

- Production-Build erzeugt Service Worker (`dist/sw.js`, Workbox).
- `vite-plugin-pwa` mit `registerType: autoUpdate`, `skipWaiting`, `clientsClaim`.
- Kein produktiver Deploy in diesem Rebuild.

## APK / Capacitor

- `capacitor.config.ts` vorhanden (`appId: de.amrtech.paymentleads`, `webDir: dist`).
- Kein `android/`-Verzeichnis in diesem Worktree → **kein APK-Build ausgeführt**.
- Profil → **App-Info**: Version sichtbar, Aktion „Auf Update prüfen“, Download-Link auf Downloads-Worker (`…/android/latest.apk`).
- Keine separate APK-CSS-Welt.

## Quality Gates (letzter Gesamtlauf)

| Gate | Ergebnis |
|------|----------|
| Vitest gesamt | 148 Dateien / 1005 Tests, EXIT 0 |
| Lint (oxlint) | EXIT 0 |
| `tsc -b` | EXIT 0 |
| `build:production` | EXIT 0 |
| `verify:ocr-build` | EXIT 0 |
| `secretscan:dist` | EXIT 0 |
| `git diff --check` | EXIT 0 |
| `.only` / `.skip` | keine |
