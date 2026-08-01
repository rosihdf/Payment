import type { ContractStatus } from '../../domain/contract/contractStatus';
import {
  getContractDisplayGroup,
  getContractDisplayLabel,
  getContractTechnicalLabel,
} from './contractStatusDisplay';
import styles from './ContractStatusBadge.module.css';

export function ContractStatusBadge({
  status,
  showTechnical = false,
}: {
  status: ContractStatus;
  showTechnical?: boolean;
}) {
  const group = getContractDisplayGroup(status);
  return (
    <span className={styles.badge} data-status={status} data-group={group}>
      {getContractDisplayLabel(status)}
      {showTechnical ? (
        <span className={styles.technical}> · {getContractTechnicalLabel(status)}</span>
      ) : null}
    </span>
  );
}
