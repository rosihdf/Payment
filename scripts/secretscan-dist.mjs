#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'dist');
// Nur konkrete Secret-Werte, nicht Library-Prefix-Checks wie startsWith("sb_secret_")
const patterns = [
  /sb_secret_[A-Za-z0-9_-]{16,}/i,
  /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, // JWT service-role style
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/,
  /service_role["']?\s*:\s*["'][A-Za-z0-9._-]{20,}/i,
  /postgres:\/\/[^"'\s]+/i,
  /BEGIN (RSA |OPENSSH )?PRIVATE KEY/,
  /CLOUDFLARE_API_TOKEN\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/,
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path, files);
    } else if (/\.(js|html|css|json|webmanifest|mjs)$/i.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

const files = walk(root);
const hits = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      hits.push(`${file}: ${pattern}`);
    }
  }
}

if (hits.length > 0) {
  console.error('secretscan:dist FAILED');
  for (const hit of hits) console.error(hit);
  process.exit(1);
}

console.log(`secretscan:dist OK (${files.length} Dateien geprüft)`);
