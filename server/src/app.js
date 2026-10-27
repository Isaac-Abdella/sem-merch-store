const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1); // correct client IPs behind Render/Heroku/Nginx (needed by the rate limiter)
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // allow the auth cookie
  })
);

// ⚠️ Must come BEFORE express.json(): Stripe needs the raw body to verify signatures.
app.use('/api/webhooks', require('./routes/webhookRoutes'));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/tracking', require('./routes/trackingRoutes'));
app.use('/api/service-area', require('./routes/serviceAreaRoutes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
