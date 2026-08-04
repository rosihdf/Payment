# Rebuild Frontend v2 – E2E-/Abnahmeprotokoll

## Vitest
- 152 Dateien / 1073 Tests, EXIT 0

## Playwright (`npm run test:e2e`)
- 13 Tests, EXIT 0
- Außendienst: Kundensuche, Neuanlage, Beratung, Angebot, Nachfassen, Provision
- Admin: Benutzer, Tarif, Produkt, Standardprovision+Reload, Mitarbeitervereinbarung+Reload, Freigaben/Aktivierungen erreichbar
- Beratung Extra: 0 €, zurück/vor, Reload
- Öffentlicher Kundenlink: gültiger Token, ungültiger Token, Änderungswunsch
- BestPay: Closing-Schritt mit Versand-Dialog

## Quality Gates
- Lint, tsc, production-build, OCR-verify, secretscan:dist, git diff --check: EXIT 0
- Worker-/RLS-Tests in Vitest-Suite enthalten

## PWA
- Production-Preview: Service Worker aktiv inkl. Controller nach Reload
- Manifest standalone erreichbar

## Android
- APK 1.0.2 (10002) signiert gebaut (RC1-Rebuild)
- Emulator-Install und Launch erfolgreich
- Kein Upload, kein Deploy, kein Push

## RC1
Siehe `docs/revision/AMRtech-Payment-RC1-Abschluss.md`.
