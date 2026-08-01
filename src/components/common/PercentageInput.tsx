import { type ChangeEvent } from 'react';
import { FormControl } from './FormControl';

interface PercentageInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function PercentageInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: PercentageInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value) || 0);
  };

  return (
    <FormControl
      id={id}
      type="number"
      label={label}
      value={String(value)}
      disabled={disabled}
      min={0}
      max={100}
      onChange={handleChange}
    />
  );
}
