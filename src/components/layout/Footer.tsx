import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <p>© {new Date().getFullYear()} AMRtech · ArioSales</p>
    </footer>
  );
}
