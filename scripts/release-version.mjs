import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

/** Repo-Wurzel (übersteuerbar für Tests). */
export function resolveRepoRoot(rootDir = join(scriptDir, '..')) {
  return rootDir;
}

export const RELEASE_DOWNLOAD_WORKER_BASE =
  'https://amrtech-payment-downloads.amrtech.workers.dev';

export const EXPECTED_RELEASE_SIGNING_SHA256 =
  'd3f85fb274c460139b178b76c93b3fda555fa48b0d960b9817be4d85f174fd9d';

/** Sichtbarer Release-APK-Dateiname (lokal). */
export function releaseApkBasename(versionName) {
  return `ArioSales-${versionName}.apk`;
}

/** R2-/Worker-kompatibler APK-Dateiname (bestehende Infrastruktur). */
export function r2ApkBasename(versionName) {
  return `AMRtech-Payment-${versionName}.apk`;
}

/** Fester MediaStore-Downloads-Dateiname für Phase-6H-Handoff. */
export const HANDOFF_APK_DISPLAY_NAME = 'ArioSales-Update.apk';

export function r2VersionedApkUrl(versionName) {
  return `${RELEASE_DOWNLOAD_WORKER_BASE}/android/v${versionName}/${r2ApkBasename(versionName)}`;
}

export function r2LatestApkUrl() {
  return `${RELEASE_DOWNLOAD_WORKER_BASE}/android/latest.apk`;
}

export function r2LatestJsonUrl() {
  return `${RELEASE_DOWNLOAD_WORKER_BASE}/android/latest.json`;
}

export function loadPackageJson(rootDir = resolveRepoRoot()) {
  const raw = readFileSync(join(rootDir, 'package.json'), 'utf8');
  return JSON.parse(raw);
}

export function loadReleaseVersion(rootDir = resolveRepoRoot()) {
  const pkg = loadPackageJson(rootDir);
  const versionName = pkg.version;
  const versionCode = pkg.androidVersionCode;

  if (typeof versionName !== 'string' || !/^\d+\.\d+\.\d+$/.test(versionName)) {
    throw new Error(`package.json "version" ist ungültig: ${String(versionName)}`);
  }
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error(`package.json "androidVersionCode" ist ungültig: ${String(versionCode)}`);
  }

  return { versionName, versionCode };
}

export function readGradleAndroidVersion(rootDir = resolveRepoRoot()) {
  const gradle = readFileSync(join(rootDir, 'android/app/build.gradle'), 'utf8');
  const usesPackageJson =
    gradle.includes('releaseVersionName') &&
    gradle.includes('releaseVersionCode') &&
    gradle.includes('package.json');
  if (usesPackageJson) {
    return loadReleaseVersion(rootDir);
  }
  const versionNameMatch = gradle.match(/versionName\s+"([^"]+)"/);
  const versionCodeMatch = gradle.match(/versionCode\s+(\d+)/);
  if (!versionNameMatch || !versionCodeMatch) {
    throw new Error('android/app/build.gradle: versionName/versionCode nicht gefunden');
  }
  return {
    versionName: versionNameMatch[1],
    versionCode: Number.parseInt(versionCodeMatch[1], 10),
  };
}

export function readHandoffDisplayNameFromSources(rootDir = resolveRepoRoot()) {
  const ts = readFileSync(join(rootDir, 'src/lib/androidApkSystemHandoffFlow.ts'), 'utf8');
  const java = readFileSync(
    join(rootDir, 'android/app/src/main/java/de/amrtech/paymentleads/AppUpdateSystemHandoffPlugin.java'),
    'utf8',
  );
  const tsMatch = ts.match(
    /export const ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME = '([^']+)';/,
  );
  const javaMatch = java.match(
    /LOCAL_UPDATE_APK_DISPLAY_NAME = "([^"]+)";/,
  );
  if (!tsMatch || !javaMatch) {
    throw new Error('Handoff-APK-Dateiname in TS/Java nicht gefunden');
  }
  return { ts: tsMatch[1], java: javaMatch[1] };
}

export function collectReleaseConsistencyErrors(rootDir = resolveRepoRoot()) {
  const errors = [];

  try {
    const pkg = loadReleaseVersion(rootDir);
    const gradle = readGradleAndroidVersion(rootDir);

    if (pkg.versionName !== gradle.versionName) {
      errors.push(
        `versionName drift: package.json=${pkg.versionName}, build.gradle=${gradle.versionName}`,
      );
    }
    if (pkg.versionCode !== gradle.versionCode) {
      errors.push(
        `versionCode drift: package.json androidVersionCode=${pkg.versionCode}, build.gradle=${gradle.versionCode}`,
      );
    }

    const appInfo = readFileSync(join(rootDir, 'src/utils/appInfo.ts'), 'utf8');
    if (/APP_VERSION\s*=\s*['"][\d.]+['"]/.test(appInfo)) {
      errors.push(
        'src/utils/appInfo.ts enthält noch hardcodierte APP_VERSION — erwartet Build-Time-Injection',
      );
    }
    if (/APP_VERSION_CODE\s*=\s*\d+/.test(appInfo)) {
      errors.push(
        'src/utils/appInfo.ts enthält noch hardcodierte APP_VERSION_CODE — erwartet Build-Time-Injection',
      );
    }
    if (!appInfo.includes('__APP_VERSION__') || !appInfo.includes('__APP_VERSION_CODE__')) {
      errors.push('src/utils/appInfo.ts nutzt nicht __APP_VERSION__ / __APP_VERSION_CODE__');
    }

    const handoff = readHandoffDisplayNameFromSources(rootDir);
    if (handoff.ts !== HANDOFF_APK_DISPLAY_NAME) {
      errors.push(
        `Handoff-Dateiname TS=${handoff.ts}, erwartet ${HANDOFF_APK_DISPLAY_NAME}`,
      );
    }
    if (handoff.java !== HANDOFF_APK_DISPLAY_NAME) {
      errors.push(
        `Handoff-Dateiname Java=${handoff.java}, erwartet ${HANDOFF_APK_DISPLAY_NAME}`,
      );
    }
    if (handoff.ts !== handoff.java) {
      errors.push(`Handoff-Dateiname TS/Java divergieren: ${handoff.ts} vs ${handoff.java}`);
    }

    const releaseDir = join(rootDir, 'release-artifacts', pkg.versionName, 'android');
    const latestJsonPath = join(releaseDir, 'latest.json');
    if (existsSync(latestJsonPath)) {
      const latest = JSON.parse(readFileSync(latestJsonPath, 'utf8'));
      if (latest.versionName !== pkg.versionName) {
        errors.push(
          `release-artifacts/${pkg.versionName}/android/latest.json versionName=${latest.versionName}`,
        );
      }
      if (latest.versionCode !== pkg.versionCode) {
        errors.push(
          `release-artifacts/${pkg.versionName}/android/latest.json versionCode=${latest.versionCode}`,
        );
      }
    }

    const legacyLatest = join(rootDir, 'release-artifacts/android/latest.json');
    if (existsSync(legacyLatest)) {
      errors.push(
        'Veraltetes release-artifacts/android/latest.json gefunden — bitte löschen oder via release:android neu erzeugen',
      );
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return errors;
}

export function buildLatestJson({
  versionName,
  versionCode,
  sha256,
  sizeBytes,
  sourceCommit,
  releaseNotes,
  minimumVersionCode = versionCode - 1,
}) {
  const apkUrl = r2VersionedApkUrl(versionName);
  return {
    versionName,
    versionCode,
    minimumVersionCode,
    mandatory: false,
    downloadUrl: apkUrl,
    apkUrl,
    latestVersion: versionName,
    sha256,
    sizeBytes,
    publishedAt: new Date().toISOString(),
    releaseNotes:
      releaseNotes ??
      'Update lädt die APK in Downloads und öffnet „Eigene Dateien“. Tippe auf ArioSales-Update.apk und anschließend auf Aktualisieren.',
    releaseTag: versionName,
    sourceCommit,
  };
}
