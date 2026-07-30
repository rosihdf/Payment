import { Link } from 'react-router-dom';
import styles from './AccessDenied.module.css';

interface AccessDeniedProps {
  title?: string;
  description?: string;
}

export function AccessDenied({
  title = 'Zugriff verweigert',
  description = 'Sie haben keine Berechtigung, diese Seite aufzurufen. Wenden Sie sich an einen Administrator, falls Sie Zugang benötigen.',
}: AccessDeniedProps) {
  return (
    <section aria-labelledby="access-denied-title">
      <div className={styles.container}>
        <div className={styles.icon} aria-hidden="true">
          !
        </div>
        <h1 id="access-denied-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.description}>{description}</p>
        <Link className={styles.action} to="/">
          Zurück zur Startseite
        </Link>
      </div>
    </section>
  );
}
