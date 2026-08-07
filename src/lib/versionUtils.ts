/**
 * Versionsvergleich für semantische Versionen (z. B. 1.0.0, 1.2.3).
 * 1:1 aus ArioVan Wartung (`shared/versionUtils.ts`), Typen an Payment-strictness angepasst.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  if (!latest || !current) return false;
  const cur = parseVersion(current);
  const lat = parseVersion(latest);
  if (!cur || !lat) return false;
  for (let i = 0; i < 3; i++) {
    const a = lat[i]!;
    const b = cur[i]!;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

function parseVersion(v: string): [number, number, number] | null {
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m || m[1] == null || m[2] == null || m[3] == null) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

export function isSemverComparable(v: string): boolean {
  return parseVersion(v) !== null;
}
