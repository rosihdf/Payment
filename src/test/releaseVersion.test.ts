import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, APP_VERSION_CODE } from '../utils/appInfo';
import { ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME } from '../lib/androidApkSystemHandoffFlow';

describe('Release-Version (Source of Truth)', () => {
  it('package.json und Build-Time-Injection sind synchron', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      version: string;
      androidVersionCode: number;
    };
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION_CODE).toBe(pkg.androidVersionCode);
    expect(APP_VERSION).toBe('1.0.28');
    expect(APP_VERSION_CODE).toBe(10044);
  });

  it('Gradle liest Version aus package.json', () => {
    const gradle = readFileSync('android/app/build.gradle', 'utf8');
    expect(gradle).toContain('package.json');
    expect(gradle).toContain('releaseVersionName');
    expect(gradle).toContain('releaseVersionCode');
  });

  it('Handoff-Dateiname ist in TS und Java identisch', () => {
    const ts = readFileSync('src/lib/androidApkSystemHandoffFlow.ts', 'utf8');
    const java = readFileSync(
      'android/app/src/main/java/de/amrtech/paymentleads/AppUpdateSystemHandoffPlugin.java',
      'utf8',
    );
    expect(ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME).toBe('ArioSales-Update.apk');
    expect(ts).toContain("'ArioSales-Update.apk'");
    expect(java).toContain('"ArioSales-Update.apk"');
  });

  it('appInfo.ts enthält keine hardcodierte Versionskonstante', () => {
    const src = readFileSync('src/utils/appInfo.ts', 'utf8');
    expect(src).not.toMatch(/APP_VERSION\s*=\s*['"][\d.]+['"]/);
    expect(src).not.toMatch(/APP_VERSION_CODE\s*=\s*\d+/);
    expect(src).toContain('__APP_VERSION__');
    expect(src).toContain('__APP_VERSION_CODE__');
  });

  it('release:check Script ist grün', () => {
    const result = spawnSync('node', ['scripts/release-check.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('release:check OK');
  });
});
