import { FormControl, type FormControlProps } from '../../components/common/FormControl';
import styles from './FormField.module.css';

export type { FormControlProps, FormControlOption, FormControlType } from '../../components/common/FormControl';
export { formControlClassName, textareaClassName } from '../../components/common/FormField';

export type V2FormFieldProps = FormControlProps & {
  layoutClassName?: string;
};

export function FormField({ layoutClassName, className, ...props }: V2FormFieldProps) {
  const fieldClass = [styles.field, layoutClassName].filter(Boolean).join(' ');
  const controlClass = className || undefined;

  return (
    <div className={fieldClass}>
      <FormControl {...props} className={controlClass} />
    </div>
  );
}
