import type { SalesActivity, TimelineTypeGroup } from './salesActivity';

export function activityMatchesTimelineGroup(
  activity: SalesActivity,
  group: TimelineTypeGroup | undefined,
): boolean {
  if (!group || group === 'all') {
    return true;
  }
  if (group === 'communication') {
    return activity.type === 'call' || activity.type === 'email' || activity.type === 'meeting';
  }
  if (group === 'visit') {
    return activity.type === 'visit';
  }
  if (group === 'note') {
    return activity.type === 'note';
  }
  if (group === 'system') {
    return activity.isSystem;
  }
  if (group === 'process') {
    if (activity.type === 'call' || activity.type === 'email' || activity.type === 'meeting') {
      return false;
    }
    if (activity.type === 'visit' || activity.type === 'note') {
      return false;
    }
    return true;
  }
  return true;
}
