import { SALES_WIZARD_VISIBLE_STEPS } from '../../domain/bestPayComparison/salesWizard';
import styles from './AdviceWizard.module.css';

interface WizardNavProps {
  currentStepId: string;
  stepIndex: number;
  onJump: (stepId: string) => void;
}

const STEPS = SALES_WIZARD_VISIBLE_STEPS;

export function WizardNav({ currentStepId, stepIndex, onJump }: WizardNavProps) {
  return (
    <nav className={styles.nav} aria-label="Beratungsschritte">
      {STEPS.map((entry, index) => {
        const isActive =
          entry.id === currentStepId ||
          (entry.id === 'offer' && currentStepId === 'approval');
        const isDone = index < stepIndex;
        return (
          <button
            key={entry.id}
            type="button"
            className={
              isActive ? styles.navActive : isDone ? styles.navDone : styles.navItem
            }
            onClick={() => onJump(entry.id)}
          >
            <span className={styles.navNumber}>{entry.number}</span>
            <span>{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
