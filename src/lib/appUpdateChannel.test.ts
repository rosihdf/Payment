import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  APP_UPDATE_CHANNEL_KEY,
  ANDROID_UPDATE_MANIFEST_URL_PRODUCTION,
  ANDROID_UPDATE_MANIFEST_URL_TEST,
  manifestUrlForChannel,
  parseAppUpdateChannel,
  readAppUpdateChannel,
  writeAppUpdateChannel,
} from './appUpdateChannel';
import { resolveAndroidUpdateManifestUrl } from './androidApkUpdate';

describe('appUpdateChannel', () => {
  afterEach(() => {
    localStorage.removeItem(APP_UPDATE_CHANNEL_KEY);
    vi.unstubAllEnvs();
  });

  it('parst production/test', () => {
    expect(parseAppUpdateChannel(null)).toBe('production');
    expect(parseAppUpdateChannel('test')).toBe('test');
    expect(manifestUrlForChannel('production')).toBe(ANDROID_UPDATE_MANIFEST_URL_PRODUCTION);
    expect(manifestUrlForChannel('test')).toBe(ANDROID_UPDATE_MANIFEST_URL_TEST);
  });

  it('resolveAndroidUpdateManifestUrl respektiert Kanal', () => {
    vi.stubEnv('VITE_ANDROID_UPDATE_MANIFEST_URL', '');
    writeAppUpdateChannel('test');
    expect(readAppUpdateChannel()).toBe('test');
    expect(resolveAndroidUpdateManifestUrl()).toBe(ANDROID_UPDATE_MANIFEST_URL_TEST);
    writeAppUpdateChannel('production');
    expect(resolveAndroidUpdateManifestUrl()).toBe(ANDROID_UPDATE_MANIFEST_URL_PRODUCTION);
  });
});
