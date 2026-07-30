import { useEffect, useState } from 'react';
import {
  formatTenthsOfBasisPointToPercent,
  parsePercentToTenthsOfBasisPoint,
} from '../../utils/percentage';
import { FormField } from './FormField';
import inputStyles from './inputs.module.css';

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
        placeholder="0,000"
        onChange={(event) => {
          const nextValue = event.target.value;
          setDisplayValue(nextValue);
          const parsed = parsePercentToTenthsOfBasisPoint(nextValue);
          if (parsed !== null) {
            onChange(parsed);
          }
        }}
        onBlur={() => {
          setDisplayValue(formatTenthsOfBasisPointToPercent(value).replace(' %', ''));
        }}
      />
    </FormField>
  );
}
