import styles from './AdviceWizard.module.css';

interface WizardNavProps {
  currentStepId: string;
  stepIndex: number;
  onJump: (stepId: string) => void;
}

const STEPS = [
  { id: 'prospect', number: 1, label: 'Kunde' },
  { id: 'costs', number: 2, label: 'Ausgangslage' },
  { id: 'need', number: 3, label: 'Bedarf' },
  { id: 'variants', number: 4, label: 'Empfehlung' },
  { id: 'offer', number: 5, label: 'Angebot' },
  { id: 'closing', number: 6, label: 'Prüfung & Nachfassen' },
] as const;

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
