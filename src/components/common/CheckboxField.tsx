import styles from './CheckboxField.module.css';

interface ToggleOption {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

interface CheckboxFieldProps {
  label: string;
  options: ToggleOption[];
}

export function CheckboxField({ label, options }: CheckboxFieldProps) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`${styles.toggle} ${option.checked ? styles.toggleActive : ''}`}
            aria-pressed={option.checked}
            disabled={option.disabled}
            onClick={() => option.onChange(!option.checked)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
