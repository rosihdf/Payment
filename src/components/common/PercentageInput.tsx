import { FormField } from './FormField';
import inputStyles from './inputs.module.css';

interface PercentageInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function PercentageInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: PercentageInputProps) {
  return (
    <FormField id={id} label={label}>
      <input
        id={id}
        className={inputStyles.input}
        type="number"
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </FormField>
  );
}
