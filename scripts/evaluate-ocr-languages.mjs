#!/usr/bin/env node
/**
 * Vergleicht OCR deu+eng vs. deu auf synthetischer Mixed-Language-Abrechnung.
 * Benötigt: npm run build (dist/ + OCR-Assets), Playwright Chromium.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const MIXED_BILLING_LINES = [
  'SumUp Monthly Statement / Monatsabrechnung',
  'Zeitraum: 01.01.2026 - 31.01.2026',
  'Visa / Mastercard / Debit / Credit Card Volume',
  'Kartenumsatz 12.345,67 EUR',
  'Anzahl Transaktionen / Transactions 420',
  'Terminal Rental / Terminalmiete 19,00 EUR',
  'Service Fee / Servicegebühr 5,00 EUR',
  'Clearing Fee / Clearing 12,50 EUR',
  'Transaction Fee / Transaktionsgebühr 41,50 EUR',
  'Total Amount / Monatliche Gesamtkosten 89,50 EUR',
];

function contentType(filePath) {
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.wasm')) return 'application/wasm';
  if (filePath.endsWith('.traineddata')) return 'application/octet-stream';
  if (filePath.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}

function startStaticServer() {
  const roots = [
    { prefix: '/ocr/', dir: path.join(root, 'public/ocr') },
    {
      prefix: '/tesseract/',
      dir: path.join(root, 'node_modules/tesseract.js/dist'),
    },
  ];

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = req.url?.split('?')[0] ?? '/';
      for (const entry of roots) {
        if (url.startsWith(entry.prefix)) {
          const rel = url.slice(entry.prefix.length);
          const filePath = path.join(entry.dir, rel);
          if (existsSync(filePath)) {
            res.writeHead(200, {
              'Content-Type': contentType(filePath),
              'Access-Control-Allow-Origin': '*',
            });
            res.end(readFileSync(filePath));
            return;
          }
        }
      }
      res.writeHead(404);
      res.end('not found');
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function recognize(page, baseUrl, languages) {
  return page.evaluate(
    async ({ baseUrl, languages, lines }) => {
      const createWorker = globalThis.Tesseract.createWorker;

      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1100;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('canvas unavailable');
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 36px Arial';
      for (let index = 0; index < lines.length; index += 1) {
        ctx.fillText(lines[index], 48, 80 + index * 72);
      }

      const worker = await createWorker(languages, 1, {
        workerPath: `${baseUrl}/ocr/worker/worker.min.js`,
        corePath: `${baseUrl}/ocr/core/`,
        langPath: `${baseUrl}/ocr/lang/`,
        gzip: false,
        workerBlobURL: false,
      });
      const result = await worker.recognize(canvas);
      await worker.terminate();
      return result.data.text ?? '';
    },
    { baseUrl, languages, lines: MIXED_BILLING_LINES },
  );
}

function extractKeywords(text) {
  const lower = text.toLowerCase();
  const checks = {
    provider: /sumup/i.test(text),
    cardVolume: /12[.\s]*345[,\s]*67|12345/i.test(text),
    transactions: /\b420\b/.test(text),
    terminal: /terminal/i.test(text) && /19[,\s]*00|19,00/.test(text),
    total: /89[,\s]*50|89,50/.test(text),
    visa: /visa/i.test(text),
    mastercard: /mastercard/i.test(text),
    clearing: /clearing/i.test(text),
    service: /service/i.test(text),
    mixedEnglish: /monthly|statement|transaction|total amount/i.test(lower),
  };
  return checks;
}

async function main() {
  if (!existsSync(path.join(root, 'public/ocr/lang/deu.traineddata'))) {
    throw new Error('OCR assets missing – run npm run copy:ocr-assets');
  }

  const { server, baseUrl } = await startStaticServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/ocr/worker/worker.min.js`).catch(() => undefined);
    await page.setContent(
      `<!doctype html><html><head><script src="${baseUrl}/tesseract/tesseract.min.js"></script></head><body></body></html>`,
      { waitUntil: 'load' },
    );
    await page.waitForFunction(() => typeof globalThis.Tesseract !== 'undefined');
    const deuEngText = await recognize(page, baseUrl, 'deu+eng');
    const deuText = await recognize(page, baseUrl, 'deu');

    const deuEngChecks = extractKeywords(deuEngText);
    const deuChecks = extractKeywords(deuText);

    const criticalKeys = ['provider', 'cardVolume', 'transactions', 'terminal', 'total'];
    const deuEngOk = criticalKeys.every((key) => deuEngChecks[key]);
    const deuOk = criticalKeys.every((key) => deuChecks[key]);

    const report = {
      deuEngOk,
      deuOk,
      deuEngChecks,
      deuChecks,
      deuEngTextPreview: deuEngText.slice(0, 400),
      deuTextPreview: deuText.slice(0, 400),
      recommendation: deuOk && deuOk === deuEngOk ? 'remove_eng' : 'keep_eng',
    };

    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.recommendation === 'remove_eng' ? 0 : 2;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
