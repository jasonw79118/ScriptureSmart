import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/ScriptureSmart/',
  plugins: [react()],
  server: { proxy: { '/api/ai': { target: 'http://127.0.0.1:8787' } } },
});
