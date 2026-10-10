import { defineConfig, loadEnv } from 'vite';
import {
  getDecodedRequestPathname,
  isProtectedRoutePath,
  shouldBlockDevStaticFallback,
} from './scripts/protected-routes.mjs';

const PUBLIC_DEV_SOURCE_MODULES = new Set([
  '/src/bootstrap.ts',
  '/src/lib/auth.ts',
  '/src/lib/telegram.ts',
]);

function blockProtectedPath(response: import('node:http').ServerResponse): void {
  response.writeHead(404, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end('{"ok":false,"error":"not_found"}');
}

function rejectPrivateDevRequest(
  response: import('node:http').ServerResponse,
  statusCode = 401,
): void {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify({
    ok: false,
    error: statusCode === 401 ? 'not_authenticated' : 'auth_unavailable',
  }));
}

function requiresDevSession(pathname: string): boolean {
  const normalizedPathname = pathname.replaceAll('\\', '/').toLowerCase();

  return (
    normalizedPathname === '/assets' ||
    normalizedPathname.startsWith('/assets/') ||
    normalizedPathname === '/private' ||
    normalizedPathname.startsWith('/private/') ||
    (normalizedPathname.startsWith('/src/') && !PUBLIC_DEV_SOURCE_MODULES.has(normalizedPathname)) ||
    normalizedPathname.startsWith('/@fs/') ||
    normalizedPathname.startsWith('/@id/') ||
    normalizedPathname.startsWith('/node_modules/') ||
    normalizedPathname.startsWith('/scripts/')
  );
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const mediaPort = env.MEDIA_PORT || '8081';
  const appServerPort = env.LOCAL_API_PORT || env.APP_SERVER_PORT || '8787';

  return {
    plugins: [{
      name: 'protect-dynamic-routes',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          // Exact lowercase routes continue to Vite's backend proxy. Encoded,
          // mixed-case and backslash variants must never fall through to the
          // workspace/public file servers on Windows.
          if (shouldBlockDevStaticFallback(request.url)) {
            blockProtectedPath(response);
            return;
          }

          const decodedPathname = getDecodedRequestPathname(request.url);

          if (decodedPathname && requiresDevSession(decodedPathname)) {
            try {
              const authResponse = await fetch(
                `http://127.0.0.1:${appServerPort}/internal/media-auth`,
                {
                  headers: { Cookie: String(request.headers.cookie || '') },
                  signal: AbortSignal.timeout(3_000),
                },
              );

              if (authResponse.status !== 204) {
                rejectPrivateDevRequest(response);
                return;
              }
            } catch {
              rejectPrivateDevRequest(response, 503);
              return;
            }
          }

          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((request, response, next) => {
          const decodedPathname = getDecodedRequestPathname(request.url);

          if (decodedPathname && isProtectedRoutePath(decodedPathname)) {
            blockProtectedPath(response);
            return;
          }

          next();
        });
      },
    }],
    build: {
      // hls.js is intentionally lazy-loaded only on HLS lessons.
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          entryFileNames: 'public/[name]-[hash].js',
          chunkFileNames: 'private/[name]-[hash].js',
          assetFileNames: 'private/[name]-[hash][extname]',
        },
      },
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
