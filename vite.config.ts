import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { hiiApiPlugin } from './server/apiMiddleware';

export default defineConfig({
  plugins: [react(), hiiApiPlugin()],
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  server: {
    port: 5195,
    host: true,
  },
});
