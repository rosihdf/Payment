import { CheckboxField } from '../../components/common/CheckboxField';
import { TERMINAL_TYPE_LABELS, TERMINAL_TYPE_OPTIONS, type TerminalType } from '../../domain/tariff/tariff';
import styles from './TerminalTypeSelector.module.css';

interface TerminalTypeSelectorProps {
  value: TerminalType[];
  onChange: (value: TerminalType[]) => void;
  error?: string;
  disabled?: boolean;
}

export function TerminalTypeSelector({
  value,
  onChange,
  error,
  disabled = false,
}: TerminalTypeSelectorProps) {
  const toggleType = (type: TerminalType, checked: boolean) => {
    if (checked) {
      onChange([...value, type]);
      return;
    }

    onChange(value.filter((item) => item !== type));
  };

  return (
    <div className={styles.wrapper}>
      <CheckboxField
        label="Einsatzarten"
        options={TERMINAL_TYPE_OPTIONS.map((type) => ({
          id: `terminal-${type}`,
          label: TERMINAL_TYPE_LABELS[type],
          checked: value.includes(type),
          disabled,
          onChange: (checked) => toggleType(type, checked),
        }))}
      />
      {error ? (
        <p className={styles.error} id="supportedTerminalTypes-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
