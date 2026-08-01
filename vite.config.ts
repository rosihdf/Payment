import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'AMRtech Payment Leads',
        short_name: 'Payment Leads',
        description: 'Außendienst-App zur Aufnahme und zum Vergleich von Payment-Leads',
        theme_color: '#1e3a5f',
        background_color: '#f4f6f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // autoUpdate: neuer Deploy ersetzt die alte App-Shell ohne manuelles Cache-Löschen
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /\/ocr\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-assets-cache',
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/tesseract.js') || id.includes('node_modules/tesseract.js-core')) {
            return 'ocr-tesseract';
          }
          if (id.includes('node_modules/pdfjs-dist')) {
            return 'pdf-processing';
          }
          if (
            id.includes('/billingImportEngine/providers/browserOcrExtractionProvider') ||
            id.includes('/billingImportEngine/providers/lazyBrowserOcrExtractionProvider') ||
            id.includes('/billingImportEngine/ocr/') ||
            id.includes('/billingImportEngine/billingImagePreprocessing') ||
            id.includes('/billingImportEngine/billingPdfPageRenderer')
          ) {
            return 'billing-ocr-feature';
          }
        },
      },
    },
  },
});
