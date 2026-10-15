const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Only trust X-Forwarded-For when explicitly told there's a real reverse proxy in
// front of this process — otherwise a client could spoof it to dodge rate limits.
if (config.trustProxy) app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (config.nodeEnv !== 'test') app.use(morgan('dev'));

// General ceiling across the whole API, independent of the stricter login-specific
// limiter in auth.routes.js. Generous enough for normal dashboard/list-page use
// (filters, pagination, polling) while still bounding abuse/scraping.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down', error: 'RATE_LIMITED' },
});
app.use('/api', apiLimiter);

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
