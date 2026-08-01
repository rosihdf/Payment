#!/usr/bin/env node

const baseUrl = (process.env.PRODUCTION_URL ?? '').replace(/\/$/, '');

if (!baseUrl) {
  console.error('PRODUCTION_URL fehlt (z. B. https://amrtech-payment.<account>.workers.dev).');
  process.exit(1);
}

const response = await fetch(baseUrl);
if (!response.ok) {
  console.error(`Smoke fehlgeschlagen: HTTP ${response.status}`);
  process.exit(1);
}

const html = await response.text();
if (!html.includes('<div id="root"') && !html.includes('id="root"')) {
  console.error('Smoke fehlgeschlagen: SPA-Root nicht gefunden.');
  process.exit(1);
}

console.log(`Smoke OK: ${baseUrl} (${response.status})`);
