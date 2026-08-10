#!/usr/bin/env node
import { readFile, readdir, access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

const REQUIRED_OCR_FILES = [
  'ocr/worker/worker.min.js',
  'ocr/core/tesseract-core-lstm.wasm.js',
  'ocr/core/tesseract-core-simd-lstm.wasm.js',
  'ocr/lang/deu.traineddata',
];

const FORBIDDEN_OCR_FILES = [
  'ocr/core/tesseract-core-lstm.wasm',
  'ocr/core/tesseract-core-simd-lstm.wasm',
  'ocr/lang/deu.traineddata.gz',
  'ocr/lang/eng.traineddata',
  'ocr/lang/eng.traineddata.gz',
];

const blockedOcrHosts = [
  'cdn.jsdelivr.net/npm/tesseract',
  'cdn.jsdelivr.net/npm/@tesseract.js-data',
  'cdn.jsdelivr.net/npm/tesseract.js-core',
];

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function verify() {
  if (!(await exists(distDir))) {
    throw new Error('dist/ not found – run npm run build first');
  }

  for (const relativePath of REQUIRED_OCR_FILES) {
    if (!(await exists(path.join(distDir, relativePath)))) {
      throw new Error(`Required OCR asset missing: dist/${relativePath}`);
    }
  }

  for (const relativePath of FORBIDDEN_OCR_FILES) {
    if (await exists(path.join(distDir, relativePath))) {
      throw new Error(`Forbidden OCR asset must not be shipped: dist/${relativePath}`);
    }
  }

  const ocrDir = path.join(distDir, 'ocr');
  const ocrFiles = (await walk(ocrDir)).map((file) => path.relative(ocrDir, file));
  const allowedLang = new Set(['deu.traineddata']);
  for (const rel of ocrFiles) {
    if (rel.startsWith(`lang${path.sep}`)) {
      const name = rel.slice(5);
      if (!allowedLang.has(name)) {
        throw new Error(`Unexpected OCR language asset: dist/ocr/lang/${name}`);
      }
    }
  }

  const files = await walk(distDir);
  const assetFiles = files.filter((file) => file.includes(`${path.sep}assets${path.sep}`));
  const jsFiles = assetFiles.filter((file) => file.endsWith('.js') || file.endsWith('.mjs'));

  const indexHtml = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const entryMatch = indexHtml.match(/src="([^"]+assets\/index-[^"]+\.js)"/);
  if (!entryMatch) {
    throw new Error('Main entry chunk not found in dist/index.html');
  }

  const mainEntryFile = path.join(distDir, entryMatch[1].replace(/^\//, ''));
  const mainEntrySource = await readFile(mainEntryFile, 'utf8');
  if (/tesseract\.js|createWorker|worker\.min\.js|traineddata/.test(mainEntrySource)) {
    throw new Error('Main entry chunk still contains Tesseract runtime references');
  }

  const ocrChunks = jsFiles.filter((file) =>
    /ocr-tesseract|billing-ocr-feature|billingOcrAsset/i.test(path.basename(file)),
  );
  if (ocrChunks.length === 0) {
    throw new Error('No OCR lazy chunks found in dist/assets');
  }

  let sameOriginPathFound = false;
  for (const file of ocrChunks) {
    const base = path.basename(file);
    if (base.startsWith('ocr-tesseract')) {
      continue;
    }

    const source = await readFile(file, 'utf8');
    if (source.includes('/ocr/worker/') || source.includes('ocr/core/') || source.includes('ocr/lang/')) {
      sameOriginPathFound = true;
    }
    for (const host of blockedOcrHosts) {
      if (source.includes(host)) {
        throw new Error(`Blocked OCR host "${host}" found in ${path.relative(root, file)}`);
      }
    }
    if (/workerPath:\s*[`'"]https:\/\/cdn\.jsdelivr/.test(source)) {
      throw new Error(`Active CDN workerPath found in ${path.relative(root, file)}`);
    }
    if (/eng\.traineddata|'deu\+eng'|"deu\+eng"|languages:\s*['"]deu\+eng/.test(source)) {
      throw new Error(`English OCR language reference found in ${path.relative(root, file)}`);
    }
  }

  if (!sameOriginPathFound) {
    throw new Error('OCR chunks do not reference local /ocr/ asset paths');
  }

  const deuSize = (await stat(path.join(distDir, 'ocr/lang/deu.traineddata'))).size;
  console.log('OCR build verification passed');
  console.log(`Main entry: ${path.relative(root, mainEntryFile)}`);
  console.log(`OCR lazy chunks: ${ocrChunks.map((file) => path.basename(file)).join(', ')}`);
  console.log(`dist/ocr assets: worker, both core JS variants, deu (${deuSize} bytes)`);
}

verify().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
