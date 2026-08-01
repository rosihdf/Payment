import { useEffect, useState, type ChangeEvent } from 'react';
import { formatInteger, parseIntegerInput } from '../../utils/currency';
import { FormControl } from './FormControl';

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
  min: _min,
  placeholder,
}: NumberInputProps) {
  void _min;
  const [displayValue, setDisplayValue] = useState(formatInteger(value));

  useEffect(() => {
    setDisplayValue(formatInteger(value));
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDisplayValue(nextValue);
    onChange(parseIntegerInput(nextValue));
  };

  const handleBlur = () => {
    setDisplayValue(formatInteger(value));
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
      placeholder={placeholder}
      inputMode="numeric"
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
