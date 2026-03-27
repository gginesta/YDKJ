import { createServer } from 'http';
import next from 'next';
import { parse } from 'url';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Dynamic imports to work around path alias issues
  const { initSocketServer } = await import('./src/lib/socket/server.js');
  const { startCleanupInterval } = await import('./src/lib/game-engine/room-manager.js');

  // Attach Socket.io to the HTTP server
  initSocketServer(httpServer);

  // Start room auto-cleanup
  startCleanupInterval();

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server attached`);
  });
});
