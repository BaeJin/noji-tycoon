import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mapEditor: resolve(__dirname, 'map-editor.html')
      }
    }
  }
});
