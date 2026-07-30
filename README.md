# AMRtech Payment Leads

Außendienst-Anwendung zur Aufnahme von Payment-Leads und zum Vergleich zwischen dem aktuellen Payment-Anbieter eines Interessenten und einem BestPay-Angebot.

## Technologie

- React + TypeScript
- Vite
- React Router
- vite-plugin-pwa
- Vitest
- Capacitor (vorbereitet)

## Entwicklung

```bash
npm install
npm run dev
```

## Qualitätssicherung

```bash
npm run lint
npm run test
npm run build
```

## Architektur

- **UI** arbeitet ausschließlich über Repository-Interfaces und Services
- **Repositories** kapseln den Datenzugriff (localStorage)
- **Services** enthalten Geschäftslogik
- **Domainmodelle** sind frei von UI-Abhängigkeiten

## PWA

Die Anwendung ist als Progressive Web App installierbar. Service Worker und Offline-App-Shell sind über `vite-plugin-pwa` eingerichtet.

## Capacitor (Mobile)

Capacitor ist vorbereitet. Native Projekte wurden noch nicht angelegt.

Spätere Schritte für Android:

```bash
npm run build
npx cap sync
npx cap add android
npx cap open android
```

## Demo-Rollen

Im Header kann zwischen Demo-Benutzern gewechselt werden:

- 3× Außendienst
- 1× Admin

Die Navigation passt sich der gewählten Rolle an.

## Routen

| Route | Beschreibung |
|-------|--------------|
| `/` | Dashboard |
| `/leads` | Lead-Übersicht |
| `/leads/new` | Neuer Lead (Platzhalter) |
| `/leads/:id` | Lead-Detail |
| `/calculator` | Vergleichsrechner (Platzhalter) |
| `/admin/tariffs` | Tarifverwaltung (Admin) |
| `/profile` | Profil |
