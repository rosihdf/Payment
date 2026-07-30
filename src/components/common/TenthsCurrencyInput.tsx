import { useEffect, useState } from 'react';
import { FormField } from './FormField';
import inputStyles from './inputs.module.css';
import {
  formatTenthsOfCentToCurrency,
  parseCurrencyToTenthsOfCent,
} from '../../utils/tenthsOfCent';

interface TenthsCurrencyInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

export function TenthsCurrencyInput({
  id,
  label,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
}: TenthsCurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(formatTenthsOfCentToCurrency(value));

  useEffect(() => {
    setDisplayValue(formatTenthsOfCentToCurrency(value));
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
        placeholder="0,000 €"
        onChange={(event) => {
          const nextValue = event.target.value;
          setDisplayValue(nextValue);
          const parsed = parseCurrencyToTenthsOfCent(nextValue);
          if (parsed !== null) {
            onChange(parsed);
          }
        }}
        onBlur={() => {
          setDisplayValue(formatTenthsOfCentToCurrency(value));
        }}
      />
    </FormField>
  );
}
