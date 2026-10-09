import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const mediaPort = env.MEDIA_PORT || '8081';
  const appServerPort = env.LOCAL_API_PORT || env.APP_SERVER_PORT || '8787';

  return {
    build: {
      // hls.js is intentionally lazy-loaded only on HLS lessons.
      chunkSizeWarningLimit: 650,
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'],
      proxy: {
        '/api': `http://127.0.0.1:${appServerPort}`,
        '/auth': `http://127.0.0.1:${appServerPort}`,
        '/data': `http://127.0.0.1:${appServerPort}`,
        '/media': `http://127.0.0.1:${mediaPort}`,
        '/telegram': `http://127.0.0.1:${appServerPort}`,
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
      allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'],
    },
  };
});
