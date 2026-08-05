# 01 – Git- und Release-Inventur

Stand der Erhebung: 2026-08-04, Projekt `/Users/micha/amrtech-payment-leads`.
Nur Ist-Zustand, keine Änderungen.

## 1.1 Ermittelte Fakten

| Gegenstand | Wert | Quelle |
|---|---|---|
| Aktueller Branch | `main` | `git branch --show-current` |
| HEAD | `223b3f14667283bb47c50d920e647605590264d3` | `git rev-parse HEAD` |
| HEAD-Commitmeldung | `docs(rc): record Android 1.0.2 source commit in release prep` | `git log -1` |
| `origin/main` | `223b3f1466…` (identisch mit HEAD) | `git ls-remote origin` |
| `origin/rebuild/frontend-v2` | `223b3f1466…` (identisch mit HEAD) | `git ls-remote origin` |
| Tag `v1.0.2` | Tag-Objekt `6034027c2ca8…`, zeigt auf Commit `223b3f1466…` | `git ls-remote origin` |
| Tag `v1.0.0` | Tag-Objekt `a726298f5850…`, zeigt auf Commit `4a8d369a8245…` | `git ls-remote origin` |
| Offene lokale Commits | keine (`## main...origin/main` ohne ahead/behind) | `git status -sb` |
| Untracked Dateien | keine | `git status --porcelain` (leer) |
| Working Tree | clean | `git status --porcelain` (leer) |

## 1.2 Branches und Worktrees

| Branch | Commit | Art |
|---|---|---|
| `main` | `223b3f1466…` | Hauptbranch, aktueller Worktree |
| `rebuild/frontend-v2` | `223b3f1466…` | Rebuild-Branch, vollständig in `main` gemerged, inhaltlich identisch |
| `release/android-1.0.1` | `7dbd2a22…` | separater Worktree `/Users/micha/amrtech-payment-leads-apk-v1.0.0` |
| `remotes/origin/main` | `223b3f1466…` | Remote |
| `remotes/origin/rebuild/frontend-v2` | `223b3f1466…` | Remote |

Worktrees (`git worktree list`):

```
/Users/micha/amrtech-payment-leads             223b3f1 [main]
/Users/micha/amrtech-payment-leads-apk-v1.0.0  7dbd2a2 [release/android-1.0.1]
```

Der Android-Release-Worktree ist ein **Altstand** (`release/android-1.0.1`, Commit `7dbd2a2`). Er trägt weder den 1.0.2-Stand noch ist er Quelle der veröffentlichten APK. Die veröffentlichte APK 1.0.2 wurde im Haupt-Worktree gebaut.

## 1.3 Live-Stand Cloudflare

Worker `amrtech-payment` (`wrangler.toml`, `workers_dev = true`), Assets aus `./dist`.

Live-Abruf `https://amrtech-payment.amrtech.workers.dev/` → HTTP 200, ausgelieferte Bundles:

```
assets/index-BC-8sjn5.js
assets/index-DD5_Kyba.css
```

Lokales `dist/index.html` referenziert **dieselben** Dateinamen. Die Vite-Bundlenamen sind Content-Hashes, damit ist der Live-Stand byte-identisch mit dem lokalen Build von HEAD `223b3f1466…`.

Weitere Live-Prüfungen:

| Ressource | HTTP | Größe |
|---|---|---|
| `/ocr/worker/worker.min.js` | 200 | 111.162 Bytes |
| `/ocr/lang/deu.traineddata.gz` | 200 | 1.333.102 Bytes |

Die OCR-Assets sind live vorhanden und ausliefernd. Fehlende OCR-Assets sind damit **nicht** die Ursache für „Abrechnung einlesen funktioniert nicht" (siehe Dokument 04).

Worker `amrtech-payment-downloads`: Pfad-Allowlist in `workers/amrtech-payment-downloads/src/index.ts:5-16` enthält `/android/v1.0.2/*` und `/android/latest.*`. Ein Abruf von `/latest.json` (ohne `/android`-Präfix) liefert korrekt 404 – das ist Konfiguration, kein Fehler.

## 1.4 Version in der APK

| Prüfung | Wert |
|---|---|
| Paket | `de.amrtech.paymentleads` |
| `versionName` | `1.0.2` |
| `versionCode` | `10002` |
| APK SHA-256 | `d8cee4a7d5c51993af04e0c4ad2a025da49327b7515450007abb6a8502068c53` |
| Signatur V2 SHA-256 | `d3f85fb274c460139b178b76c93b3fda555fa48b0d960b9817be4d85f174fd9d` |
| `package.json` version | `1.0.2` |
| `src/utils/appInfo.ts` | `APP_VERSION = '1.0.2'`, `APP_VERSION_CODE = 10002` |

Webassets in der APK (`android/app/src/main/assets/public/index.html`):

```
assets/index-BC-8sjn5.js
assets/index-DD5_Kyba.css
```

**Identisch mit Live-Worker und lokalem `dist`.** Die APK enthält damit exakt denselben Frontend-Stand wie die Live-PWA – inklusive aller in Dokument 03–06 belegten Fehler.

## 1.5 Übersichtstabelle

| Bereich | Commit | Branch/Tag | Live ja/nein | relevant für Kern ja/nein |
|---|---|---|---|---|
| Repository HEAD | `223b3f1466…` | `main` | – | ja |
| Remote Hauptbranch | `223b3f1466…` | `origin/main` | – | ja |
| Rebuild-Branch | `223b3f1466…` | `rebuild/frontend-v2` (identisch mit main) | – | nein (redundant) |
| Release-Tag | `223b3f1466…` | Tag `v1.0.2` | ja (entspricht Live) | ja |
| Alt-Tag | `4a8d369a8245…` | Tag `v1.0.0` | nein | nein |
| Cloudflare Web/PWA `amrtech-payment` | `223b3f1466…` (Bundle `index-BC-8sjn5.js`) | `main` / `v1.0.2` | **ja** | ja |
| Cloudflare Downloads `amrtech-payment-downloads` | `223b3f1466…` | `main` | ja | nein (nur Verteilung) |
| Android APK 1.0.2 | `223b3f1466…` (Bundle `index-BC-8sjn5.js`) | `main` / `v1.0.2` | **ja** (verteilt) | ja |
| Android-Worktree | `7dbd2a22…` | `release/android-1.0.1` | nein | nein (Altstand) |
| Supabase-Schema | Migration `20260802213926 phase1b_sales_process` (letzte von 25) | – | **ja** | ja |

## 1.6 Befunde

1. **Ein einziger Codestand ist überall aktiv.** HEAD, `origin/main`, `rebuild/frontend-v2`, Tag `v1.0.2`, Live-Worker und APK zeigen alle auf `223b3f1466…`. Es gibt keine Divergenz zwischen „was getestet wurde" und „was läuft".
2. **Der Rebuild-Branch ist redundant** und kann ohne Informationsverlust entfallen; er ist inhaltlich identisch mit `main`.
3. **Der Android-Worktree `release/android-1.0.1` ist eine Altlast** (Commit `7dbd2a2`) und für den Kern irrelevant.
4. **Die APK ist kein separater Fehlerraum.** Da Bundlehashes identisch sind, gilt jeder Frontendbefund für Desktop, PWA und APK gleichermaßen.
5. **Der Release-Prozess selbst ist konsistent.** Versionen, Hashes und Signaturen stimmen überein. Das Problem liegt nicht in der Auslieferung, sondern im ausgelieferten Verhalten.
