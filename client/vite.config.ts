import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Generic chunk filenames for the sensitive lazy modules. The signup
        // pitch modal (JoinPremiumModal) lands in a chunk named like
        // `assets/m-AbCd.js` instead of `assets/JoinPremiumModal-AbCd.js`.
        // That way a bot that grabs the main bundle and sees the dynamic
        // import URL can't fingerprint the chunk by name alone — and an
        // automated `find */JoinPremium*` style probe gets nothing.
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name || '';
          if (/Join|Premium|Invit|Welcome/i.test(name)) {
            return 'assets/m-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
})
