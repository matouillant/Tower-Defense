import { defineConfig } from 'vite';

// En développement, le client (port 5173) relaie les WebSockets vers le serveur de jeu (port 3000).
export default defineConfig({
  server: { host: true, proxy: { '/api/ws': { target: 'ws://localhost:3000', ws: true } } },
  // Les illustrations restent des fichiers à part : le chargeur de Phaser ne lit pas les SVG intégrés en « data: ».
  build: { chunkSizeWarningLimit: 2000, assetsInlineLimit: 0 },
});
