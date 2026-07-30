import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import styles from './FormField.module.css';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({
  id,
  label,
  required = false,
  error,
  hint,
  children,
}: FormFieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');

  const control =
    isValidElement(children) && describedBy
      ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
          'aria-describedby': describedBy,
        })
      : children;

  return (
    <div className={styles.field}>
      <label className={`${styles.label} ${required ? styles.labelRequired : ''}`} htmlFor={id}>
        {label}
      </label>
      <div className={styles.control}>{control}</div>
      {hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
