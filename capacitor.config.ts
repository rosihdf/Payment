import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.amrtech.paymentleads',
  appName: 'AMRtech Payment',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
