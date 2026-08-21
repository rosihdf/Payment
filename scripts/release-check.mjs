#!/usr/bin/env node
import { collectReleaseConsistencyErrors, resolveRepoRoot } from './release-version.mjs';

const errors = collectReleaseConsistencyErrors(resolveRepoRoot());

if (errors.length > 0) {
  console.error('release:check FAILED');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log('release:check OK');
