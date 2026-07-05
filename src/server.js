/**
 * server.js
 * Layer: entry point — starts the HTTP server.
 * Listening only; the app is assembled in app.js so tests can exercise it
 * without opening a socket.
 */

import { app } from './app.js';

// Bind to all interfaces and honor the platform-assigned port (Railway).
const HOST = '0.0.0.0';
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, HOST, () => {
  console.log(`[server] listening on port ${PORT} (${HOST}, ${NODE_ENV})`);
});
