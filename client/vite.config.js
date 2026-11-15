import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // While developing, send API calls to the Express server.
  server: { proxy: { '/api': 'http://localhost:5000', '/socket.io': { target: 'ws://localhost:5000', ws: true } } },
});
