import { useEffect, useState, type ChangeEvent } from 'react';
import {
  formatTenthsOfBasisPointToPercent,
  parsePercentToTenthsOfBasisPoint,
} from '../../utils/percentage';
import { FormControl } from './FormControl';

interface PercentageTenthsRateInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
}

export function PercentageTenthsRateInput({
  id,
  label,
  value,
  onChange,
  error,
  disabled = false,
}: PercentageTenthsRateInputProps) {
  const [displayValue, setDisplayValue] = useState(
    formatTenthsOfBasisPointToPercent(value).replace(' %', ''),
  );

  useEffect(() => {
    setDisplayValue(formatTenthsOfBasisPointToPercent(value).replace(' %', ''));
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDisplayValue(nextValue);
    const parsed = parsePercentToTenthsOfBasisPoint(nextValue);
    if (parsed !== null) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setDisplayValue(formatTenthsOfBasisPointToPercent(value).replace(' %', ''));
  };

  return (
    <FormControl
      id={id}
      type="text"
      label={label}
      error={error}
      value={displayValue}
      disabled={disabled}
      placeholder="0,000"
      inputMode="decimal"
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
