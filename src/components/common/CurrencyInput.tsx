import { useEffect, useState, type ChangeEvent } from 'react';
import { formatCentsToCurrency, parseCurrencyToCents } from '../../utils/currency';
import { FormControl } from './FormControl';

interface CurrencyInputProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  /** Wenn true, wird onChange erst bei Blur ausgelöst – Eingabe bleibt beim Tippen erhalten. */
  commitOnBlur?: boolean;
}

export function CurrencyInput({
  id,
  label,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  commitOnBlur = false,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(formatCentsToCurrency(value));

  useEffect(() => {
    setDisplayValue(formatCentsToCurrency(value));
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDisplayValue(nextValue);
    if (!commitOnBlur) {
      onChange(parseCurrencyToCents(nextValue));
    }
  };

  const handleBlur = () => {
    const cents = parseCurrencyToCents(displayValue);
    if (commitOnBlur) {
      onChange(cents);
    }
    setDisplayValue(formatCentsToCurrency(commitOnBlur ? cents : value));
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
      placeholder="0,00 €"
      inputMode="decimal"
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
