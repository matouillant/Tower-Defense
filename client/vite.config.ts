import { defineConfig } from 'vite';

// En développement, le client (port 5173) relaie les WebSockets vers le serveur de jeu (port 3000).
export default defineConfig({
  server: { host: true, proxy: { '/ws': { target: 'ws://localhost:3000', ws: true } } },
  build: { chunkSizeWarningLimit: 2000 },
});
