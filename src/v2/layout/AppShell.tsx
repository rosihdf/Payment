import { Outlet } from 'react-router-dom';
import { ToastContainer } from '../../components/feedback/Toast';
import { Footer } from '../../components/layout/Footer';
import { Header } from '../../components/layout/Header';
import { BottomNavigation } from '../../components/navigation/BottomNavigation';
import { SidebarNavigation } from '../../components/navigation/SidebarNavigation';
import { AndroidApkUpdateAvailableBanner } from '../../features/androidUpdate/AndroidApkUpdateAvailableBanner';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <Header />
      <AndroidApkUpdateAvailableBanner />
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
