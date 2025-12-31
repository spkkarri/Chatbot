// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // --- ADD THIS SECTION TO FIX THE "global is not defined" ERROR ---
  define: {
    'global': {},
  },
  server:{
    host: true, 
    port:5173,
  }
})
