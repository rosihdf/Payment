import {
  pickSalesGuideTip,
  SALES_GUIDE_PHASES,
  SALES_GUIDE_PRINCIPLE,
  type SalesGuideContext,
} from '../../domain/sales/salesGuide';
import { useSalesGuideTipsEnabled } from '../../hooks/useSalesGuideTipsEnabled';
import styles from './SalesGuidePanel.module.css';

interface SalesGuidePanelProps {
  context: SalesGuideContext;
  tipSeed?: string;
  compact?: boolean;
}

export function SalesGuidePanel({ context, tipSeed, compact = false }: SalesGuidePanelProps) {
  const phase = SALES_GUIDE_PHASES[context];
  const { tipsEnabled, setTipsEnabled } = useSalesGuideTipsEnabled();
  const tip = tipSeed ? pickSalesGuideTip(tipSeed) : pickSalesGuideTip(context);

  return (
    <aside
      className={compact ? `${styles.panel} ${styles.compact}` : styles.panel}
      aria-labelledby={`sales-guide-${context}`}
    >
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Verkaufsprozess · Phase {phase.phase}</p>
          <h2 id={`sales-guide-${context}`} className={styles.title}>
            {phase.title}
          </h2>
        </div>
        <label className={styles.tipsToggle}>
          <input
            type="checkbox"
            checked={tipsEnabled}
            onChange={(event) => setTipsEnabled(event.target.checked)}
          />
          Verkaufstipps
        </label>
      </div>

      <p className={styles.summary}>{phase.summary}</p>

      {phase.emphasis ? <p className={styles.emphasis}>{phase.emphasis}</p> : null}

      <ul className={styles.hints}>
        {phase.hints.map((hint) => (
          <li key={hint}>{hint}</li>
        ))}
      </ul>

      {phase.examples && phase.examples.length > 0 ? (
        <div className={styles.examples}>
          <p className={styles.examplesTitle}>Beispielfragen</p>
          <ul>
            {phase.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {tipsEnabled ? <p className={styles.tip}>Tipp: {tip}</p> : null}

      {!compact ? (
        <p className={styles.principle}>{SALES_GUIDE_PRINCIPLE.summary}</p>
      ) : null}
    </aside>
  );
}
