import { useEffect, useState, type ChangeEvent } from 'react';
import { formatBasisPointsToPercent, parsePercentToBasisPoints } from '../../utils/percentage';
import { FormControl } from './FormControl';

interface PercentageRateInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
}

export function PercentageRateInput({
  id,
  label,
  value,
  onChange,
  error,
  disabled = false,
}: PercentageRateInputProps) {
  const [displayValue, setDisplayValue] = useState(
    formatBasisPointsToPercent(value).replace(' %', ''),
  );

  useEffect(() => {
    setDisplayValue(formatBasisPointsToPercent(value).replace(' %', ''));
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDisplayValue(nextValue);
    const parsed = parsePercentToBasisPoints(nextValue);
    if (parsed !== null) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setDisplayValue(formatBasisPointsToPercent(value).replace(' %', ''));
  };

  return (
    <FormControl
      id={id}
      type="text"
      label={label}
      error={error}
      value={displayValue}
      disabled={disabled}
      placeholder="0,00"
      inputMode="decimal"
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
