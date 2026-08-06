#!/usr/bin/env node
/**
 * Kopiert OCR-Runtime-Assets nach public/ocr.
 *
 * Wichtig: Android aapt entpackt Dateien mit Endung `.gz` und entfernt die Endung.
 * Deshalb liefern wir unkomprimierte `.traineddata` und setzen tesseract.js `gzip: false`.
 */
import { cp, mkdir, access, unlink } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicOcr = path.join(root, 'public', 'ocr');

const copies = [
  {
    from: path.join(root, 'node_modules/tesseract.js/dist/worker.min.js'),
    to: path.join(publicOcr, 'worker/worker.min.js'),
  },
  {
    from: path.join(root, 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js'),
    to: path.join(publicOcr, 'core/tesseract-core-lstm.wasm.js'),
  },
  {
    from: path.join(root, 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm'),
    to: path.join(publicOcr, 'core/tesseract-core-lstm.wasm'),
  },
  // Chromium/Safari wählen oft die SIMD-Variante – ohne Kopie scheitert der Worker-Load.
  {
    from: path.join(root, 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js'),
    to: path.join(publicOcr, 'core/tesseract-core-simd-lstm.wasm.js'),
  },
  {
    from: path.join(root, 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm'),
    to: path.join(publicOcr, 'core/tesseract-core-simd-lstm.wasm'),
  },
];

const langGz = [
  {
    from: path.join(root, 'node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz'),
    to: path.join(publicOcr, 'lang/deu.traineddata'),
  },
  {
    from: path.join(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'),
    to: path.join(publicOcr, 'lang/eng.traineddata'),
  },
];

async function ensureCopy(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  await access(from);
  await cp(from, to);
  console.log(`copied ${path.relative(root, from)} -> ${path.relative(root, to)}`);
}

async function gunzipCopy(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  await access(from);
  await pipeline(createReadStream(from), createGunzip(), createWriteStream(to));
  console.log(`gunzip ${path.relative(root, from)} -> ${path.relative(root, to)}`);
}

async function removeStaleGz(langDir) {
  for (const name of ['deu.traineddata.gz', 'eng.traineddata.gz']) {
    const stale = path.join(langDir, name);
    if (existsSync(stale)) {
      await unlink(stale);
      console.log(`removed stale ${path.relative(root, stale)}`);
    }
  }
}

async function main() {
  for (const entry of copies) {
    await ensureCopy(entry.from, entry.to);
  }
  for (const entry of langGz) {
    await gunzipCopy(entry.from, entry.to);
  }
  await removeStaleGz(path.join(publicOcr, 'lang'));
  console.log('OCR assets copied to public/ocr');
}

main().catch((error) => {
  console.error('Failed to copy OCR assets:', error);
  process.exit(1);
});
