import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
// vitest/config — 'vite' yerine bundan alınıyor ki aşağıdaki `test` bloğu
// tip denetiminden geçsin.
import { defineConfig } from 'vitest/config'

// Marka değerleri tek kaynaktan gelir (CLAUDE.md Bölüm 1A).
// vite.config Node tarafında çalıştığı için sabitleri burada tekrar etmiyoruz;
// manifest üretimi build sırasında bu dosyadan okunur.
const APP_NAME = 'Ehrenweg'
const THEME_COLOR = '#0F766E'
const BACKGROUND_COLOR = '#0B1220'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // Çevrimdışı önbellek: uygulama kabuğu + Firestore dışı statikler.
      // Firestore'un kendi çevrimdışı kalıcılığı ayrıca açılır (src/lib/firebase.ts).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Firebase/Google uçlarını ASLA önbelleğe alma — kimlik ve veri tazeliği kritik
        navigateFallbackDenylist: [/^\/__/, /^\/api/],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description:
          'Ehrenamt finden, mitmachen, Integrationspass sammeln. / Find volunteering, take part, build your integration passport.',
        lang: 'de',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        categories: ['social', 'education', 'lifestyle'],
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        // Geliştirmede service worker kapalı — emülatör verisini önbelleğe alıp
        // kafa karıştırmasın.
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    // Capacitor canlı yeniden yükleme ve telefonla aynı ağda test için
    host: true,
  },

  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Firebase SDK büyük; ilk açılışı yavaşlatmasın diye ayrı parçaya al.
        // Rollup 5 nesne biçimini kaldırdı, fonksiyon biçimi kullanılıyor.
        manualChunks(id) {
          if (
            id.includes('node_modules/firebase') ||
            id.includes('node_modules/@firebase')
          ) {
            return 'firebase'
          }
          return undefined
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
