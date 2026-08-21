#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  EXPECTED_RELEASE_SIGNING_SHA256,
  buildLatestJson,
  loadReleaseVersion,
  r2ApkBasename,
  releaseApkBasename,
  resolveRepoRoot,
} from './release-version.mjs';

const root = resolveRepoRoot();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      JAVA_HOME:
        process.env.JAVA_HOME ??
        '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home',
      ANDROID_HOME: process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`,
    },
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Befehl fehlgeschlagen: ${command} ${args.join(' ')}`);
  }
}

function sha256File(path) {
  const hash = createHash('sha256');
  hash.update(readFileSync(path));
  return hash.digest('hex');
}

function verifyReleaseSigning(apkPath) {
  const androidHome =
    process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`;
  const apksigner = join(androidHome, 'build-tools/35.0.0/apksigner');
  if (!existsSync(apksigner)) {
    throw new Error(`apksigner nicht gefunden: ${apksigner}`);
  }
  const result = spawnSync(
    apksigner,
    ['verify', '--print-certs', apkPath],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || 'apksigner verify fehlgeschlagen');
  }
  const match = result.stdout.match(/SHA-256 digest: ([a-f0-9]{64})/i);
  if (!match) {
    throw new Error('Release-APK SHA-256 nicht ermittelbar');
  }
  if (match[1].toLowerCase() !== EXPECTED_RELEASE_SIGNING_SHA256.toLowerCase()) {
    throw new Error(
      `Release-Signing abweichend: ${match[1]} (erwartet ${EXPECTED_RELEASE_SIGNING_SHA256})`,
    );
  }
  return match[1].toLowerCase();
}

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return 'unknown';
  }
  return result.stdout.trim();
}

const { versionName, versionCode } = loadReleaseVersion(root);

console.log(`ArioSales Android Release ${versionName} (${versionCode})`);

const legacyDir = join(root, 'release-artifacts/android');
if (existsSync(legacyDir)) {
  console.warn('Entferne veraltetes release-artifacts/android/ …');
  rmSync(legacyDir, { recursive: true, force: true });
}

run('node', ['scripts/release-check.mjs']);
run('npm', ['run', 'build']);
run('npx', ['cap', 'sync', 'android']);
run('./gradlew', ['assembleRelease'], { cwd: join(root, 'android') });

const builtApk = join(root, 'android/app/build/outputs/apk/release/app-release.apk');
if (!existsSync(builtApk)) {
  throw new Error(`Release-APK fehlt: ${builtApk}`);
}

const signingSha256 = verifyReleaseSigning(builtApk);
const apkSha256 = sha256File(builtApk);
const sizeBytes = readFileSync(builtApk).length;

const outDir = join(root, 'release-artifacts', versionName, 'android');
mkdirSync(outDir, { recursive: true });

const releaseApkName = releaseApkBasename(versionName);
const r2ApkName = r2ApkBasename(versionName);
const releaseApkPath = join(outDir, releaseApkName);
const r2ApkPath = join(outDir, r2ApkName);
const latestApkPath = join(outDir, 'latest.apk');

copyFileSync(builtApk, releaseApkPath);
copyFileSync(builtApk, r2ApkPath);
copyFileSync(builtApk, latestApkPath);

for (const target of [releaseApkPath, r2ApkPath, latestApkPath]) {
  writeFileSync(`${target}.sha256`, `${apkSha256}  ${target.split('/').pop()}\n`, 'utf8');
}

const latestJson = buildLatestJson({
  versionName,
  versionCode,
  sha256: apkSha256,
  sizeBytes,
  sourceCommit: gitHead(),
});

writeFileSync(join(outDir, 'latest.json'), `${JSON.stringify(latestJson, null, 2)}\n`, 'utf8');
writeFileSync(
  join(outDir, 'manifest.json'),
  `${JSON.stringify(latestJson, null, 2)}\n`,
  'utf8',
);

console.log('');
console.log('Release-Artefakte:');
console.log(`  ${releaseApkPath}`);
console.log(`  ${r2ApkPath} (R2-Upload-Name)`);
console.log(`  ${latestApkPath}`);
console.log(`  ${join(outDir, 'latest.json')}`);
console.log(`  APK SHA-256: ${apkSha256}`);
console.log(`  Signing SHA-256: ${signingSha256}`);
console.log('');
console.log('Manueller R2-Upload (nicht automatisch):');
console.log(`  android/v${versionName}/${r2ApkName}`);
console.log(`  android/v${versionName}/${r2ApkName}.sha256`);
console.log(`  android/latest.apk`);
console.log(`  android/latest.json`);
