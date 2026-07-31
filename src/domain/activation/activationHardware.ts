export const CURRENT_ACTIVATION_HARDWARE_SCHEMA_VERSION = 1;

export type ActivationHardwareStatus =
  | 'planned'
  | 'ordered'
  | 'assigned'
  | 'shipped'
  | 'delivered'
  | 'setup'
  | 'tested'
  | 'active'
  | 'returned'
  | 'deviation';

export const ACTIVATION_HARDWARE_STATUS_LABELS: Record<ActivationHardwareStatus, string> = {
  planned: 'Geplant',
  ordered: 'Bestellt',
  assigned: 'Seriennummer zugeordnet',
  shipped: 'Versendet',
  delivered: 'Zugestellt',
  setup: 'Eingerichtet',
  tested: 'Getestet',
  active: 'Aktiv',
  returned: 'Zurückgesendet',
  deviation: 'Abweichung',
};

/** One physical/logical unit derived from a ContractVersion hardware line quantity. */
export interface ActivationHardwareAssignment {
  id: string;
  schemaVersion: number;
  activationId: string;
  /** Stable reference into the ContractVersion hardware array, e.g. `{contractVersionId}:{index}`. */
  contractHardwareLineKey: string;
  unitIndex: number;
  productId: string | null;
  productName: string;
  model: string;
  mobility: 'stationary' | 'mobile' | 'unknown';
  acquisition: 'purchase' | 'rental' | 'unknown';
  status: ActivationHardwareStatus;
  serialNumber: string | null;
  orderedAt: string | null;
  orderReference: string | null;
  assignedAt: string | null;
  shippedAt: string | null;
  shippingCarrierNote: string;
  shippingTrackingReference: string | null;
  deliveryAddressNote: string;
  deliveredAt: string | null;
  setupAt: string | null;
  testedAt: string | null;
  activatedAt: string | null;
  handoverAt: string | null;
  handoverToName: string;
  handoverNote: string;
  note: string;
  sourceKey: string;
  createdAt: string;
  updatedAt: string;
}
