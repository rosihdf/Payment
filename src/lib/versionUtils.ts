/**
 * Versionsvergleich für semantische Versionen (z. B. 1.0.0, 1.2.3).
 */
export const isNewerVersion = (current: string, latest: string): boolean => {
  if (!latest || !current) return false;
  const cur = parseVersion(current);
  const lat = parseVersion(latest);
  if (!cur || !lat) return false;
  for (let i = 0; i < 3; i++) {
    const c = cur[i] ?? 0;
    const l = lat[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
};

const parseVersion = (v: string): [number, number, number] | null => {
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
};

export const isSemverComparable = (v: string): boolean => parseVersion(v) !== null;
