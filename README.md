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

## Vergleichsrechner

Unter `/calculator` vergleicht die Anwendung bisherige Payment-Konditionen mit einem aktiven BestPay-Tarif.

- Berechnung basiert auf bisherigen Konditionen und dem gewählten aktiven Tarif
- Geldwerte intern in Cent, Transaktions- und Clearingpreise in Zehntelcent (1 = 0,1 Cent)
- Prozentwerte intern in Zehntel-Basispunkten (249 = 0,249 %)
- Monatliche Fixkosten aus Grundgebühr je Vertrag, Terminalmiete je Terminal und Servicepauschale je Terminal
- Initiale Tarifkatalogdaten: BestPay Mobile A920 Classic und Flat (interne Produktcodes `BP-A920-CLASSIC`, `BP-A920-FLAT`)
- Non-EWR- und Commercial-Card-Markups sowie Zubehör sind noch nicht Teil des Vergleichs
- Lokale Berechnung ohne Backend
- Keine Angebots- oder PDF-Erstellung in A05

## Tarifverwaltung

- Echte BestPay A920-Tarife aus Flyer-Unterlagen (Classic und Flat)
- Produktcodes sind interne App-Codes, nicht als offizielle BestPay-Produktcodes ausgewiesen
- Unbekannte Vertragslaufzeiten, Kündigungsfristen und Inklusivtransaktionen bleiben offen (`null` / „Keine Angabe“)
- Versionierte Katalogmigration entfernt alte Demo-Platzhalter (`BP-START`, `BP-BUSINESS`, `BP-FLEX`) idempotent

## Routen

| Route | Beschreibung |
|-------|--------------|
| `/` | Dashboard |
| `/leads` | Lead-Übersicht |
| `/leads/new` | Neuer Lead |
| `/leads/:id` | Lead-Detail |
| `/calculator` | BestPay-Vergleichsrechner |
| `/products` | Produktkatalog (Admin und Außendienst, nur aktive Produkte) |
| `/admin/products` | Produktverwaltung (Admin) |
| `/admin/products/new` | Neues Produkt (Admin) |
| `/admin/products/:id/edit` | Produkt bearbeiten (Admin) |
| `/admin/tariffs` | Tarifverwaltung (Admin) |
| `/profile` | Profil |

## Produktkatalog

Unter `/products` zeigt die Anwendung den BestPay-Hardware- und Produktkatalog für Admin und Außendienst. Nur aktive Produkte sind sichtbar; der Außendienst kann Produkte ansehen, aber nicht bearbeiten.

Unter `/admin/products` verwaltet der Admin alle Produkte inklusive inaktiver Einträge.

### Abgrenzung zu Payment-Tarifen

Produkte und Payment-Tarife sind getrennte Domänen:

- **Produkte:** Hardware, Kassensysteme, Zubehör, Softwaremodule, Dienstleistungen
- **Tarife:** Payment-Konditionen (z. B. BestPay Mobile A920 Classic/Flat)

Es gibt keine automatische Tarifempfehlung, keine Produktpakete und keine Angebotskonfiguration in A06. Gemeinsam genutzt wird nur die Terminalart (stationär/mobil) zur Darstellung — ohne fachliche Verknüpfung.

### Produktkategorien

| Kategorie | Beschreibung |
|-----------|--------------|
| `payment_terminal` | Kartenterminal |
| `cash_register` | Kassensystem |
| `cash_register_module` | Kassenmodul |
| `accessory` | Zubehör |
| `service` | Dienstleistung |

### Preisarten

- **Monatlich** — wiederkehrende Miete oder Pauschale
- **Einmalig** — einmalige Kosten
- **Inklusive** — im Produkt enthalten (Preis 0 €)
- **Auf Anfrage** — kein belegter Preis (Blanko-Angebote)

Geldwerte intern in Cent. Einige Produkte haben einen zweiten Preisbestandteil (z. B. Premium Line: Kassenmiete + Swissbit TSE Stick).

### Initiale Katalogprodukte

19 belegte Produkte aus BestPay-Unterlagen (Premium Line, Zusatzmodule, CCV-Kassensysteme, A920-Zubehör, Blanko-Kassensysteme auf Anfrage). Interne Produktcodes beginnen mit `BP-`.

### Speicherung

Produkte werden lokal in `localStorage` gehalten. Die versionierte Katalogmigration (`productCatalogVersion: 1`) ergänzt fehlende Initialprodukte idempotent, ohne bestehende Admin-Produkte zu überschreiben.
