require('dotenv').config();

for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const nodeEnv = process.env.NODE_ENV || 'development';

// A short/weak JWT secret is a real risk in production (brute-forceable signing
// key); dev/test stay lenient so local setup with a placeholder secret isn't blocked.
if (nodeEnv === 'production' && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production — generate one with `openssl rand -base64 48`');
}

module.exports = {
  nodeEnv,
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  // Opt-in only: blindly trusting X-Forwarded-For without an actual reverse proxy
  // in front of the app lets a client spoof their IP and bypass rate limiting.
  trustProxy: process.env.TRUST_PROXY === 'true',
};
