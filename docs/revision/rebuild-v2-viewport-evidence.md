# Rebuild Frontend v2 – Viewport-/Mobile-/PWA-/Android-Nachweis

**Branch:** rebuild/frontend-v2  
**Stand:** Abnahmeabschluss (ohne Push/Deploy)

## Responsive

Automatisiert: `src/test/v2ResponsiveViewport.test.tsx`  
Breiten: 360 · 390 · 412 · 768 · 960 · 1280 px  
Routen u. a.: Arbeitsplatz, Kundenliste, Kunde neu, Kundenakte, Beratung, Angebotsliste, Aktivierungen, Provision, Admin Benutzer/Katalog, Profil.

Screenshots: `docs/revision/screenshots/` (66 PNGs).

## PWA (real geprüft gegen Production-Preview)

- `dist/sw.js` erzeugt und unter Preview mit HTTP 200 erreichbar
- Manifest `manifest.webmanifest` verlinkt (`display: standalone`)
- Browser-Check: Service Worker registered, active, controller nach Reload vorhanden
- Kernrouten Preview HTTP 200: `/`, `/sales`, `/leads`, `/advice`, `/admin/commission/overview`, `/profile`

## Android

- `android/` aus Release-Worktree integriert (ohne Keystore/Artefakte)
- `npx cap sync android` erfolgreich
- Release-APK: versionName 1.0.2, versionCode 10002, applicationId de.amrtech.paymentleads
- Signaturprüfung `apksigner verify` EXIT 0 (derselbe Release-Keystore via `~/.amrtech/keystore.properties`)
- Emulator `amrtech_rebuild_api35`: Install Success, MainActivity startet mit WebView
- Download-Manifest erreichbar: https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json (HTTP 200)
- Kein produktiver APK-Upload

## Provision Persistenz

Tests: `commissionProvisionPersistence.test.ts`, `commissionAdminUiPersistence.test.tsx` sowie E2E Admin-Flow.

## Browser-E2E

`npm run test:e2e` → 13 Playwright-Tests grün (Außendienst, Admin, öffentlicher Kundenlink, RC1-Extras).

## RC1-Nachweis

- PWA-Preview erneut grün (SW Controller nach Reload)
- APK 1.0.2 neu signiert gebaut; Emulator Install/Launch Success
- Details: `AMRtech-Payment-RC1-Abschluss.md`
