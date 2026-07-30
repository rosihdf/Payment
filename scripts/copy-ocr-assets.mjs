#!/usr/bin/env node
import { cp, mkdir, access } from 'node:fs/promises';
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
  {
    from: path.join(root, 'node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz'),
    to: path.join(publicOcr, 'lang/deu.traineddata.gz'),
  },
  {
    from: path.join(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'),
    to: path.join(publicOcr, 'lang/eng.traineddata.gz'),
  },
];

async function ensureCopy(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  await access(from);
  await cp(from, to);
  console.log(`copied ${path.relative(root, from)} -> ${path.relative(root, to)}`);
}

async function main() {
  for (const entry of copies) {
    await ensureCopy(entry.from, entry.to);
  }
  console.log('OCR assets copied to public/ocr');
}

main().catch((error) => {
  console.error('Failed to copy OCR assets:', error);
  process.exit(1);
});
