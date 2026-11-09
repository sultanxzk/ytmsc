import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import http from 'node:http';
import { URL } from 'node:url';

// Dev-only adapter: mounts the same /api/*.js handlers under Vite dev server
function apiDevServer() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        try {
          const parsed = new URL(req.url || '/', `http://localhost`);
          const segments = parsed.pathname.replace(/^\//, '').split('/');
          const route = segments[0];
          const file = `/api/${route}.js`;
          let handler;
          if (route === 'home') ({ default: handler } = await import('./api/home.js'));
          else if (route === 'search') ({ default: handler } = await import('./api/search.js'));
          else if (route === 'lyrics') ({ default: handler } = await import('./api/lyrics.js'));
          else if (route === 'album') ({ default: handler } = await import('./api/album.js'));
          else if (route === 'artist') ({ default: handler } = await import('./api/artist.js'));
          else if (route === 'upnext') ({ default: handler } = await import('./api/upnext.js'));
          else if (route === 'related') ({ default: handler } = await import('./api/related.js'));
          else if (route === 'playlist') ({ default: handler } = await import('./api/playlist.js'));
          else if (route === 'suggestions') ({ default: handler } = await import('./api/suggestions.js'));
          else if (route === 'explore') ({ default: handler } = await import('./api/explore.js'));
          else if (route === 'resolve') ({ default: handler } = await import('./api/resolve.js'));
          else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Not found' }));
          }
          req.query = Object.fromEntries(parsed.searchParams.entries());
          await handler(req, res);
          void file;
        } catch (e) {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal', details: String(e?.message || e) }));
          }
        }
      });
    },
  };
}

export default defineConfig({
  base: '/ytmsc/',
  plugins: [react(), tailwindcss(), apiDevServer()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
});
