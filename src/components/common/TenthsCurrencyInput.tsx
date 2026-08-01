import { useEffect, useState, type ChangeEvent } from 'react';
import {
  formatTenthsOfCentToCurrency,
  parseCurrencyToTenthsOfCent,
} from '../../utils/tenthsOfCent';
import { FormControl } from './FormControl';

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

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDisplayValue(nextValue);
    const parsed = parseCurrencyToTenthsOfCent(nextValue);
    if (parsed !== null) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setDisplayValue(formatTenthsOfCentToCurrency(value));
  };

  return (
    <FormControl
      id={id}
      type="text"
      label={label}
      required={required}
      error={error}
      value={displayValue}
      disabled={disabled}
      placeholder="0,000 €"
      inputMode="decimal"
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
