import { useEffect, useState } from 'react';
import { formatCentsToCurrency, parseCurrencyToCents } from '../../utils/currency';
import { FormField } from './FormField';
import inputStyles from './inputs.module.css';

interface CurrencyInputProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

export function CurrencyInput({
  id,
  label,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(formatCentsToCurrency(value));

  useEffect(() => {
    setDisplayValue(formatCentsToCurrency(value));
  }, [value]);

  return (
    <FormField id={id} label={label} required={required} error={error}>
      <input
        id={id}
        className={`${inputStyles.input} ${error ? inputStyles.inputError : ''}`}
        type="text"
        inputMode="decimal"
        value={displayValue}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="0,00 €"
        onChange={(event) => {
          const nextValue = event.target.value;
          setDisplayValue(nextValue);
          onChange(parseCurrencyToCents(nextValue));
        }}
        onBlur={() => {
          setDisplayValue(formatCentsToCurrency(value));
        }}
      />
    </FormField>
  );
}
