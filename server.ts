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
  const { startCleanupInterval, stopCleanupInterval } = await import('./src/lib/game-engine/room-manager.js');
  const { closeDb } = await import('./src/lib/db/index.js');

  // Attach Socket.io to the HTTP server
  initSocketServer(httpServer);

  // Start room auto-cleanup
  startCleanupInterval();

  // Graceful shutdown
  const shutdown = () => {
    console.log('> Shutting down...');
    stopCleanupInterval();
    closeDb();
    httpServer.close(() => {
      console.log('> Server closed');
      process.exit(0);
    });
    // Force exit after 5s if server doesn't close
    setTimeout(() => process.exit(1), 5000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server attached`);
  });
}).catch((err) => {
  console.error('> Failed to start server:', err);
  process.exit(1);
});
