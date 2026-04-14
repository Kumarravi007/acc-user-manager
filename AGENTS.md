# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

Two-package web application (not a monorepo): `backend/` (Express + TypeScript) on port 3001 and `frontend/` (Next.js 14 App Router) on port 3000. PostgreSQL and Redis are required infrastructure. See `README.md` for full details.

### Infrastructure

PostgreSQL 15 and Redis 7 run via Docker Compose. Start them with:

```
docker compose up -d postgres redis
```

The backend will not start without both services. The worker process is embedded in the backend in dev mode (imported in `app.ts`), so running a separate worker is unnecessary.

### Database

After starting PostgreSQL, run migrations from the backend directory:

```
cd backend && npm run migrate
```

The migration tool is `node-pg-migrate`. The `DATABASE_URL` must be set in `backend/.env`.

### Environment variables

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`. Required backend env vars with no defaults: `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, `APS_CALLBACK_URL`, `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`. Use `generate-secrets.sh` to create `SESSION_SECRET` and `ENCRYPTION_KEY`. Placeholder APS credentials work for startup but OAuth flows will fail.

### Running dev servers

- Backend: `cd backend && npm run dev` (uses `tsx watch`, port 3001)
- Frontend: `cd frontend && npm run dev` (Next.js dev, port 3000)
- Health check: `curl http://localhost:3001/health`

### Lint / Build / Test

- Backend lint: `cd backend && npm run lint` — requires an `.eslintrc.*` config file (not present in repo; `npm run build` via `tsc` is the reliable check)
- Backend build: `cd backend && npm run build` (runs `tsc`)
- Frontend build: `cd frontend && npm run build`
- Frontend lint: `next lint` was removed in Next.js 16; running `npx eslint src` in the frontend directory has a circular-reference issue with the current `eslint-config-next` version. Use `npm run build` to validate frontend code.
- Backend tests: `cd backend && npm test` — Jest is configured but no test files exist yet. Use `--passWithNoTests` to avoid exit code 1.

### Gotchas

- The `docker-compose.yml` `version` key is obsolete and produces a warning; this is cosmetic.
- `next.config.js` has an `swcMinify` key that is unrecognized by Next.js 16 (warning only, does not break build).
- The frontend redirects `/` to `/login` when not authenticated. Protected routes like `/dashboard` also redirect to `/login`.
- The backend uses `ioredis` (imported in `app.ts`) but the `package.json` lists `redis` (node-redis). `ioredis` is pulled as a transitive dependency of `bullmq`.
