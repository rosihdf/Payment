import { useEffect, useState } from 'react';
import { formatBasisPointsToPercent, parsePercentToBasisPoints } from '../../utils/percentage';
import { FormField } from './FormField';
import inputStyles from './inputs.module.css';

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

  return (
    <FormField id={id} label={label} error={error}>
      <input
        id={id}
        className={`${inputStyles.input} ${error ? inputStyles.inputError : ''}`}
        type="text"
        inputMode="decimal"
        value={displayValue}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        placeholder="0,00"
        onChange={(event) => {
          const nextValue = event.target.value;
          setDisplayValue(nextValue);
          const parsed = parsePercentToBasisPoints(nextValue);
          if (parsed !== null) {
            onChange(parsed);
          }
        }}
        onBlur={() => {
          setDisplayValue(formatBasisPointsToPercent(value).replace(' %', ''));
        }}
      />
    </FormField>
  );
}
