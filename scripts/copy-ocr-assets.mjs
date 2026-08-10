#!/usr/bin/env node
/**
 * Kopiert explizit benötigte OCR-Runtime-Assets nach public/ocr.
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

/** Explizite Asset-Liste – keine Wildcards. */
const STATIC_COPIES = [
  {
    from: path.join(root, 'node_modules/tesseract.js/dist/worker.min.js'),
    to: path.join(publicOcr, 'worker/worker.min.js'),
  },
  {
    from: path.join(root, 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js'),
    to: path.join(publicOcr, 'core/tesseract-core-lstm.wasm.js'),
  },
  {
    from: path.join(root, 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js'),
    to: path.join(publicOcr, 'core/tesseract-core-simd-lstm.wasm.js'),
  },
];

const LANGUAGE_ASSETS = [
  {
    from: path.join(root, 'node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz'),
    to: path.join(publicOcr, 'lang/deu.traineddata'),
  },
];

const STALE_LANG_FILES = ['deu.traineddata.gz', 'eng.traineddata', 'eng.traineddata.gz'];

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

async function removeStaleLangFiles(langDir) {
  for (const name of STALE_LANG_FILES) {
    const stale = path.join(langDir, name);
    if (existsSync(stale)) {
      await unlink(stale);
      console.log(`removed stale ${path.relative(root, stale)}`);
    }
  }
}

async function main() {
  for (const entry of STATIC_COPIES) {
    await ensureCopy(entry.from, entry.to);
  }
  for (const entry of LANGUAGE_ASSETS) {
    await gunzipCopy(entry.from, entry.to);
  }
  await removeStaleLangFiles(path.join(publicOcr, 'lang'));
  console.log('OCR assets copied to public/ocr');
}

main().catch((error) => {
  console.error('Failed to copy OCR assets:', error);
  process.exit(1);
});
