import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative asset URLs so the production build also runs when a booth device
  // opens dist/index.html straight off a USB stick or a local folder.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/**/*', 'sounds/*'],
      manifest: {
        name: 'UK Campus Drop',
        short_name: 'Campus Drop',
        description: 'Drag UK university logos onto the right city, against the clock.',
        theme_color: '#0B2A45',
        background_color: '#0B2A45',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: './index.html',
        scope: './',
        icons: [
          { src: 'assets/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'assets/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'assets/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the booth needs is precached on first load; the hall Wi-Fi
        // is never touched again.
        globPatterns: ['**/*.{js,css,html,woff2,wav,svg,png,jpg,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
})
