import styles from './SearchField.module.css';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Suchen…',
  label = 'Suche',
}: SearchFieldProps) {
  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor="search-field">
        {label}
      </label>
      <input
        id="search-field"
        type="search"
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
