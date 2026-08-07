import { describe, expect, it } from 'vitest';

import {
  ANDROID_APK_UPDATE_AUTO_CHECK_COOLDOWN_MS,
  shouldRunAndroidApkUpdateCheck,
} from './androidApkUpdateCheckPolicy';

describe('shouldRunAndroidApkUpdateCheck', () => {
  const t0 = 1_700_000_000_000;

  it('initial ohne vorherigen Check', () => {
    expect(shouldRunAndroidApkUpdateCheck(null, t0, 'initial')).toBe(true);
  });

  it('resume innerhalb Cooldown → false', () => {
    expect(shouldRunAndroidApkUpdateCheck(t0, t0 + 60_000, 'resume')).toBe(false);
    expect(shouldRunAndroidApkUpdateCheck(t0, t0 + 60_000, 'dashboard_mount')).toBe(false);
  });

  it('resume und dashboard_mount nach Cooldown → true', () => {
    expect(
      shouldRunAndroidApkUpdateCheck(t0, t0 + ANDROID_APK_UPDATE_AUTO_CHECK_COOLDOWN_MS, 'resume'),
    ).toBe(true);
    expect(
      shouldRunAndroidApkUpdateCheck(
        t0,
        t0 + ANDROID_APK_UPDATE_AUTO_CHECK_COOLDOWN_MS,
        'dashboard_mount',
      ),
    ).toBe(true);
  });

  it('manual und info_mount umgehen Cooldown', () => {
    expect(shouldRunAndroidApkUpdateCheck(t0, t0 + 1000, 'manual')).toBe(true);
    expect(shouldRunAndroidApkUpdateCheck(t0, t0 + 1000, 'info_mount')).toBe(true);
  });

  it('force umgeht Cooldown', () => {
    expect(shouldRunAndroidApkUpdateCheck(t0, t0 + 1000, 'resume', true)).toBe(true);
  });
});
