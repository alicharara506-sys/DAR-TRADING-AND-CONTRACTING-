# Deployment Guide

## 1. Docker Compose (recommended)

```bash
git clone <repo> && cd <repo>
cp backend/.env.example backend/.env       # optional for local dev

# production secrets — REQUIRED
export DB_PASSWORD='a-strong-db-password'
export JWT_ACCESS_SECRET="$(openssl rand -base64 48)"
export JWT_REFRESH_SECRET="$(openssl rand -base64 48)"
export ANTHROPIC_API_KEY='sk-ant-...'      # optional: enables LLM-polished AI answers

docker compose up -d --build
```

Services:

| Service | Port | Notes |
|---|---|---|
| web | 3000 | Next.js standalone; proxies `/api/v1/*` to `api` |
| api | 4000 | runs `prisma migrate deploy` on boot; `/api/v1/health`; Swagger at `/api/docs` |
| seed | — | one-shot: loads the full workbook dataset, then exits |
| db | 5432 (internal) | PostgreSQL 16 with named volume |

For a real domain, terminate TLS in front (Caddy/nginx/traefik) and point it at `web:3000`.
Set `CORS_ORIGINS=https://your-domain` on the api service.

## 2. Environment variables (backend)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✔ | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✔ | ≥32 chars, distinct values |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | | default `900s` / `7d` |
| `CORS_ORIGINS` | ✔ prod | comma-separated allowed origins |
| `UPLOAD_DIR` / `MAX_UPLOAD_SIZE_MB` | | default `./uploads` / `25` |
| `ANTHROPIC_API_KEY` / `AI_MODEL` | | optional AI enrichment (`claude-sonnet-5` default) |
| `SMTP_*` | | optional email service |

Frontend: `API_INTERNAL_URL` — internal URL the Next server proxies API calls to.

## 3. Manual (PM2 / bare metal)

```bash
# API
cd backend && npm ci && npx prisma migrate deploy && npm run build
npx ts-node prisma/seed.ts        # first boot only
pm2 start dist/main.js --name dar-api

# Web
cd ../frontend && npm ci && npm run build
API_INTERNAL_URL=http://localhost:4000 pm2 start npm --name dar-web -- start
```

## 4. Production hardening checklist

- [ ] Rotate both JWT secrets; never use the compose defaults
- [ ] Restrict `CORS_ORIGINS` to the real domain
- [ ] Put TLS in front (HSTS on)
- [ ] Schedule `pg_dump` backups of the `db_data` volume
- [ ] Change all seeded account passwords immediately (`Admin@123!`)
- [ ] Point uptime monitoring at `GET /api/v1/health`
- [ ] Review the `VIEWER` role for client-portal exposure
