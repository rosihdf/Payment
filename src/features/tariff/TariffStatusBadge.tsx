import { TARIFF_STATUS_LABELS, type TariffStatus } from '../../domain/tariff/tariff';
import styles from './TariffStatusBadge.module.css';

interface TariffStatusBadgeProps {
  status: TariffStatus;
}

export function TariffStatusBadge({ status }: TariffStatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${status === 'active' ? styles.active : styles.inactive}`}>
      {TARIFF_STATUS_LABELS[status]}
    </span>
  );
}
