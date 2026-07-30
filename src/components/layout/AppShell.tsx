import { Outlet } from 'react-router-dom';
import { ToastContainer } from '../feedback/Toast';
import { BottomNavigation } from '../navigation/BottomNavigation';
import { SidebarNavigation } from '../navigation/SidebarNavigation';
import { Footer } from './Footer';
import { Header } from './Header';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <Header />
      <div className={styles.body}>
        <SidebarNavigation />
        <main className={styles.main}>
          <div className={styles.content}>
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
      <BottomNavigation />
      <ToastContainer />
    </div>
  );
}
