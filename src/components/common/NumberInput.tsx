import { useEffect, useState } from 'react';
import { formatInteger, parseIntegerInput } from '../../utils/currency';
import { FormField } from './FormField';
import inputStyles from './inputs.module.css';

interface NumberInputProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  placeholder?: string;
}

export function NumberInput({
  id,
  label,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  min,
  placeholder,
}: NumberInputProps) {
  const [displayValue, setDisplayValue] = useState(formatInteger(value));

  useEffect(() => {
    setDisplayValue(formatInteger(value));
  }, [value]);

  return (
    <FormField id={id} label={label} required={required} error={error}>
      <input
        id={id}
        className={`${inputStyles.input} ${error ? inputStyles.inputError : ''}`}
        type="text"
        inputMode="numeric"
        value={displayValue}
        disabled={disabled}
        min={min}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder={placeholder}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDisplayValue(nextValue);
          onChange(parseIntegerInput(nextValue));
        }}
        onBlur={() => {
          setDisplayValue(formatInteger(value));
        }}
      />
    </FormField>
  );
}
