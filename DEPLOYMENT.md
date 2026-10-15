# Deployment

This covers deploying the backend (Node/Express/Prisma/PostgreSQL) and the frontend
(static React build) to a real server. It assumes a single small VPS or a
platform like Render/Railway — this project doesn't need container
orchestration or a multi-region setup.

## 1. Database

Provision a PostgreSQL 14+ instance (a managed one — Render, Railway, Supabase,
RDS — is simpler than self-hosting). Note its connection string; you'll need it
as `DATABASE_URL`.

## 2. Backend

```bash
cd backend
npm ci --omit=dev          # production install, no dev/test dependencies
cp .env.example .env       # then edit .env for production, see below
npx prisma migrate deploy  # applies migrations; does NOT prompt or reset data
npx prisma generate
npm run seed                # optional — only for a fresh environment that wants demo data
npm start
```

### Production `.env`

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Your real Postgres connection string |
| `JWT_SECRET` | **Required to be 32+ characters** — the app refuses to boot otherwise when `NODE_ENV=production` (see Phase 11). Generate one with `openssl rand -base64 48`. |
| `JWT_EXPIRES_IN` | `8h` is a reasonable default; shorten if session length is a concern |
| `PORT` | Whatever your platform expects (many PaaS platforms inject this themselves) |
| `CORS_ORIGIN` | The exact origin the frontend is served from, e.g. `https://inventory.yourfactory.com` — wrong value here is the most common deploy-time bug, since the browser will silently block every API call |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `true` **only if** there's a real reverse proxy/load balancer in front of this process (nginx, the platform's own edge). Leaving it `true` with no real proxy in front lets a client spoof `X-Forwarded-For` to dodge rate limiting — see Phase 11's note. |

Run the app with a process manager so it restarts on crash — `pm2 start src/server.js --name sugarcane-api`, or a systemd unit, or just let the PaaS platform manage the process (Render/Railway do this for you).

### Database migrations on future deploys

Every time the schema changes, run `npx prisma migrate deploy` as part of the
deploy step **before** starting the new app version — never `migrate dev` in
production (it can prompt interactively and isn't meant for non-interactive
pipelines).

## 3. Frontend

```bash
cd frontend
npm ci
npm run build    # outputs to frontend/dist/
```

`dist/` is a static site — serve it with any static host (Vercel, Netlify,
Cloudflare Pages, or just nginx pointed at the folder). Two things it needs:

- **The API base URL.** `src/api/client.js` currently points at `/api` (a
  relative path, relying on `vite.config.js`'s dev-only proxy). For a
  production build where the frontend and backend are on different origins,
  set the real backend URL — either rewrite `client.js`'s `baseURL` to an
  environment-driven value (e.g. `import.meta.env.VITE_API_URL`) before
  building, or serve the frontend from the same origin as the API (e.g. the
  backend serves `dist/` as static files and proxies `/api` to itself) so the
  relative path keeps working unchanged.
- **SPA fallback routing.** This is a client-side-routed app (React Router) —
  the static host must serve `index.html` for any unknown path (not a 404),
  or refreshing on `/items` or `/purchases/5` will break. Vercel/Netlify do
  this automatically for a Vite app; a plain nginx config needs a
  `try_files $uri /index.html;` fallback.

## 4. Checklist before going live

- [ ] `JWT_SECRET` is a real random 32+ character value, not the placeholder from `.env.example`
- [ ] `CORS_ORIGIN` matches the frontend's actual deployed origin exactly (including `https://`, no trailing slash)
- [ ] HTTPS is terminated somewhere in front of the backend (the platform's edge, or nginx + Let's Encrypt) — this app doesn't terminate TLS itself
- [ ] `TRUST_PROXY` is only `true` if there's an actual proxy in front
- [ ] The seeded demo users' passwords have been changed (or the seed step skipped entirely) before any real data enters the system
- [ ] Database backups are configured — most managed Postgres providers offer automatic daily backups; turn this on
- [ ] `npx prisma migrate deploy` has been run against the production database before the new app version starts

## 5. Running the test suite

See the "Running the tests" section in `README.md` — unit tests (`npm run
test:unit`) need nothing but Node; integration tests (`npm run
test:integration`) need a real (ideally disposable) test database, migrated
the same way as above but pointed at a database you're fine with wiping
(`resetDb()` in `tests/integration/helpers.js` deletes all rows between
tests).
