# Rebuild Frontend v2 – E2E-/Abnahmeprotokoll

## Vitest
- 152 Dateien / 1073 Tests, EXIT 0

## Playwright (`npm run test:e2e`)
- 8 Tests, EXIT 0
- Außendienst: Kundensuche, Neuanlage, Beratung, Angebot, Nachfassen, Provision
- Admin: Benutzer, Tarif, Standardprovision+Reload, Freigaben/Aktivierungen erreichbar
- Öffentlicher Kundenlink: gültiger Token zeigt Angebot; ungültiger Token Fehler

## Quality Gates
- Lint, tsc, production-build, OCR-verify, secretscan:dist, git diff --check: EXIT 0
- Worker-/RLS-Tests in Vitest-Suite enthalten

## PWA
- Production-Preview: Service Worker aktiv inkl. Controller nach Reload
- Manifest standalone erreichbar

## Android
- APK 1.0.2 (10002) signiert gebaut
- Emulator-Install und Launch erfolgreich
- Kein Upload, kein Deploy, kein Push
