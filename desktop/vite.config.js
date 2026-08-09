import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config padrao do Tauri: porta fixa 1420 e sem limpar a tela, senao o log do
// Rust some no meio do output do Vite.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: 'chrome110',
    sourcemap: false,
  },
});
