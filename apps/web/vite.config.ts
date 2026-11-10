import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Strip console.* calls from production builds */
function stripConsole(): Plugin {
  return {
    name: 'strip-console',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('node_modules') || !code.includes('console.')) return null;
      // Replace console method references with no-op so console.log("x") becomes (() => {})("x")
      const stripped = code.replace(
        /\bconsole\.(log|warn|error|debug|info|trace)\b/g,
        '(() => {})'
      );
      return stripped !== code ? stripped : null;
    },
  };
}

export default defineConfig({
  plugins: [react(), stripConsole()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600, // Increase slightly from default 500
  },
  optimizeDeps: {
    // Exclude FFmpeg from optimization so wasm files are handled correctly
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
});
