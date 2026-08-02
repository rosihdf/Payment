import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import styles from './FormControl.module.css';

export interface FormControlOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type FormControlType =
  | 'text'
  | 'search'
  | 'email'
  | 'password'
  | 'number'
  | 'date'
  | 'datetime-local'
  | 'select';

interface FormControlBaseProps {
  id?: string;
  label?: string;
  hideLabel?: boolean;
  required?: boolean;
  error?: string | boolean;
  hint?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

interface FormControlInputProps extends FormControlBaseProps {
  type: Exclude<FormControlType, 'select'>;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: InputHTMLAttributes<HTMLInputElement>['onBlur'];
  min?: string | number;
  max?: string | number;
  autoComplete?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  name?: string;
}

interface FormControlSelectProps extends FormControlBaseProps {
  type: 'select';
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options?: FormControlOption[];
  children?: ReactNode;
  name?: string;
}

export type FormControlProps = FormControlInputProps | FormControlSelectProps;

function parseOptionChildren(children: ReactNode): FormControlOption[] {
  const options: FormControlOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    const element = child as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;
    if (element.type !== 'option') {
      return;
    }
    const optionValue = element.props.value ?? '';
    const label =
      typeof element.props.children === 'string' || typeof element.props.children === 'number'
        ? String(element.props.children)
        : String(optionValue);
    options.push({
      value: String(optionValue),
      label,
      disabled: element.props.disabled,
    });
  });
  return options;
}

function createSelectChangeEvent(value: string): ChangeEvent<HTMLSelectElement> {
  return {
    target: { value } as HTMLSelectElement,
    currentTarget: { value } as HTMLSelectElement,
  } as ChangeEvent<HTMLSelectElement>;
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CustomSelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
  error = false,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  name,
}: {
  id: string;
  value: string;
  options: FormControlOption[];
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder ?? '';

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setHighlightIndex(-1);
    }
  }, [open]);

  const enabledOptions = options.filter((option) => !option.disabled);

  const selectValue = (nextValue: string) => {
    setOpen(false);
    onChange(createSelectChangeEvent(nextValue));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightIndex(Math.max(0, enabledOptions.findIndex((option) => option.value === value)));
        return;
      }
      setHighlightIndex((current) => {
        const next = current + 1;
        return next >= enabledOptions.length ? 0 : next;
      });
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightIndex(Math.max(0, enabledOptions.findIndex((option) => option.value === value)));
        return;
      }
      setHighlightIndex((current) => {
        const next = current - 1;
        return next < 0 ? enabledOptions.length - 1 : next;
      });
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightIndex(Math.max(0, enabledOptions.findIndex((option) => option.value === value)));
        return;
      }
      if (highlightIndex >= 0 && enabledOptions[highlightIndex]) {
        selectValue(enabledOptions[highlightIndex].value);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={styles.selectRoot} ref={rootRef}>
      {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        data-value={value}
        className={`${styles.control} ${styles.selectTrigger} ${error ? styles.controlError : ''}`}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.selectValue}>{displayLabel}</span>
        <span className={styles.selectChevron}>
          <ChevronIcon />
        </span>
      </button>
      {open ? (
        <ul id={`${id}-listbox`} role="listbox" className={styles.selectMenu}>
          {options.map((option, index) => {
            const enabledIndex = enabledOptions.findIndex((entry) => entry.value === option.value);
            const highlighted = enabledIndex >= 0 && enabledIndex === highlightIndex;
            return (
              <li
                key={`${option.value}-${index}`}
                role="option"
                aria-selected={option.value === value}
                data-value={option.value}
                className={[
                  styles.selectOption,
                  option.value === value ? styles.selectOptionSelected : '',
                  highlighted ? styles.selectOptionHighlighted : '',
                  option.disabled ? styles.selectOptionDisabled : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => {
                  if (!option.disabled && enabledIndex >= 0) {
                    setHighlightIndex(enabledIndex);
                  }
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!option.disabled) {
                    selectValue(option.value);
                  }
                }}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function FormControl(props: FormControlProps) {
  const generatedId = useId();
  const controlId = props.id ?? generatedId.replace(/:/g, '');
  const hasError = Boolean(props.error);
  const errorMessage = typeof props.error === 'string' ? props.error : undefined;
  const describedBy = [
    props['aria-describedby'],
    errorMessage ? `${controlId}-error` : null,
    props.hint ? `${controlId}-hint` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const fieldClassName = [styles.field, props.className].filter(Boolean).join(' ');

  let control: ReactNode;

  if (props.type === 'select') {
    const options = props.options ?? parseOptionChildren(props.children);
    control = (
      <CustomSelect
        id={controlId}
        value={props.value}
        options={options}
        onChange={props.onChange}
        disabled={props.disabled}
        error={hasError}
        placeholder={props.placeholder}
        ariaLabel={props['aria-label'] ?? (props.hideLabel ? props.label : undefined)}
        ariaDescribedBy={describedBy || undefined}
        name={props.name}
      />
    );
  } else {
    control = (
      <input
        id={controlId}
        name={props.name}
        type={props.type}
        className={`${styles.control} ${hasError ? styles.controlError : ''}`}
        value={props.value}
        onChange={props.onChange}
        onBlur={props.onBlur}
        disabled={props.disabled}
        required={props.required}
        placeholder={props.placeholder}
        min={props.min}
        max={props.max}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        aria-label={props['aria-label'] ?? (props.hideLabel ? props.label : undefined)}
        aria-describedby={describedBy || undefined}
        aria-invalid={hasError}
      />
    );
  }

  return (
    <div className={fieldClassName}>
      {props.label && !props.hideLabel ? (
        <label
          className={`${styles.label} ${props.required ? styles.labelRequired : ''}`}
          htmlFor={controlId}
        >
          {props.label}
        </label>
      ) : null}
      {control}
      {props.hint ? (
        <p id={`${controlId}-hint`} className={styles.hint}>
          {props.hint}
        </p>
      ) : null}
      {errorMessage ? (
        <p id={`${controlId}-error`} className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
