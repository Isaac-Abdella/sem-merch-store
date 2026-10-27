require('dotenv').config({ quiet: true });

const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const { initSockets } = require('./sockets/tracking');

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')} — copy .env.example to .env`);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  await connectDB();
  const server = http.createServer(app);
  initSockets(server);
  server.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    console.log(`Geocoder: ${process.env.GEOCODER || 'mock'} | Payments: ${process.env.PAYMENT_PROVIDER || 'auto'}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
