import {
  getVisibleWizardStepIndex,
  SALES_WIZARD_VISIBLE_STEPS,
  type SalesWizardStepId,
} from '../../domain/bestPayComparison/salesWizard';
import styles from './AdviceWizard.module.css';

interface WizardNavProps {
  currentStepId: string;
  stepIndex: number;
  maxReachedStep: SalesWizardStepId;
  onJump: (stepId: string) => void;
}

const STEPS = SALES_WIZARD_VISIBLE_STEPS;

export function WizardNav({ currentStepId, stepIndex, maxReachedStep, onJump }: WizardNavProps) {
  const maxReachedVisibleIndex = getVisibleWizardStepIndex(maxReachedStep);

  return (
    <nav className={styles.nav} aria-label="Beratungsschritte">
      {STEPS.map((entry, index) => {
        const isActive =
          entry.id === currentStepId ||
          (entry.id === 'offer' && currentStepId === 'approval');
        const isReachable = index <= maxReachedVisibleIndex;
        const isComplete = isReachable && index < stepIndex;
        const className = isActive
          ? styles.navActive
          : isComplete
            ? styles.navDone
            : isReachable
              ? styles.navReached
              : styles.navDisabled;

        return (
          <button
            key={entry.id}
            type="button"
            className={className}
            disabled={!isReachable && !isActive}
            aria-current={isActive ? 'step' : undefined}
            aria-disabled={!isReachable && !isActive ? true : undefined}
            onClick={() => onJump(entry.id)}
          >
            <span className={styles.navNumber}>{isComplete ? '✓' : entry.number}</span>
            <span>{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
