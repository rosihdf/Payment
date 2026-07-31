import { CONTRACT_STATUS_LABELS, type ContractStatus } from '../../domain/contract/contractStatus';
import styles from './ContractStatusBadge.module.css';

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span className={styles.badge} data-status={status}>
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}
