import type { Offer } from '../offer/offer';
import {
  APPROVAL_DEVIATION_FIELD_MESSAGE,
  APPROVAL_WAITING_STATUS_LABEL,
} from './salesGuide';
import type { SalesActivity } from '../salesWorkspace/salesActivity';
import type { UserRole } from '../user/user';

export interface SalesGuideNotification {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
  offerId: string | null;
  leadId: string | null;
}

const ADMIN_NOTIFICATION_TITLES = new Set([
  'Angebot wartet auf Freigabe',
  'Änderung erneut eingereicht',
  'Freigabe angefordert',
  'Außendienst hat Änderungen vorgenommen',
  'Sonderprovision beantragt',
]);

const FIELD_SERVICE_NOTIFICATION_TITLES = new Set([
  'Angebot freigegeben',
  'Angebot abgelehnt',
  'Änderung erforderlich',
  'Kunde angenommen',
  'Kunde hat unterschrieben',
  'Provision freigegeben',
  'Provision ausgezahlt',
]);

function isNotificationForRole(title: string, role: UserRole): boolean {
  if (role === 'admin') {
    return (
      ADMIN_NOTIFICATION_TITLES.has(title) ||
      FIELD_SERVICE_NOTIFICATION_TITLES.has(title)
    );
  }
  return FIELD_SERVICE_NOTIFICATION_TITLES.has(title);
}

function activityToNotification(activity: SalesActivity): SalesGuideNotification {
  return {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    occurredAt: activity.occurredAt,
    offerId: activity.offerId,
    leadId: activity.leadId,
  };
}

export function buildSalesGuideNotifications(
  activities: SalesActivity[],
  role: UserRole,
  offersInApproval: Offer[],
): SalesGuideNotification[] {
  const fromActivities = activities
    .filter((activity) => activity.isSystem && isNotificationForRole(activity.title, role))
    .map(activityToNotification);

  const approvalNotifications: SalesGuideNotification[] =
    role === 'admin'
      ? offersInApproval.map((offer) => ({
          id: `approval-pending:${offer.id}`,
          title: 'Angebot wartet auf Freigabe',
          description: `${offer.offerNumber || offer.id} · Version ${offer.currentVersionNumber}`,
          occurredAt: offer.updatedAt,
          offerId: offer.id,
          leadId: offer.leadId,
        }))
      : offersInApproval.map((offer) => ({
          id: `approval-pending-field:${offer.id}`,
          title: APPROVAL_WAITING_STATUS_LABEL,
          description: APPROVAL_DEVIATION_FIELD_MESSAGE,
          occurredAt: offer.updatedAt,
          offerId: offer.id,
          leadId: offer.leadId,
        }));

  const merged = [...approvalNotifications, ...fromActivities];
  const seen = new Set<string>();
  return merged
    .filter((entry) => {
      const key = `${entry.title}:${entry.offerId ?? entry.id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 8);
}
