# DAR Construction ERP Platform

**Enterprise Construction ERP for DAR Trading & Contracting** — a full re-engineering of the
DAR Project Planning Workbook into a production web platform: CPM scheduling, Earned Value
Management, procurement, inventory, HR/payroll, QHSE, document control and an AI project
assistant, in English, العربية (RTL) and Français.

<p>
  <b>Backend</b>: NestJS · TypeScript · Prisma · PostgreSQL · JWT + RBAC · Swagger ·
  <b>Frontend</b>: Next.js (App Router) · React · Tailwind CSS · React Query · Framer Motion
</p>

---

## What was extracted from the workbook — and how it was improved

| Workbook sheet | Platform module | Enterprise upgrade |
|---|---|---|
| Dashboard | Executive + Project dashboards | Live multi-project portfolio, EVM S-curve, health scoring |
| Project Info | Projects | Multi-project, contract terms drive invoice math (VAT/retention/advance) |
| WBS / Task Schedule / Gantt | Scheduling engine | Real **CPM** (FS/SS/FF/SF + lag), float, critical path, **baselines**, delay analysis, SVG Gantt with dependency arrows |
| Budget Tracker | Finance / EVM | PV·EV·AC·CPI·SPI·EAC·ETC·VAC·TCPI computed **live** from baseline + cost ledger (workbook stored static numbers) |
| Cost Control | Cost codes & ledger | Posted cost entries by source (payroll/procurement/manual), category rollups, over-budget alerts |
| Cash Flow | Cash flow | Forecast lines + actuals from receipts/payments, running balance, financing-need insight |
| Procurement | PR → RFQ → Quotation → PO → GRN | Approval workflow, weighted **vendor comparison** (price 50 / delivery 30 / rating 20), goods receipts post stock |
| Material Tracker | Inventory & warehouse | Stock ledger (movements), material requests with issue workflow, reorder alerts |
| Equipment Tracker | Equipment | Assignments, utilisation, **preventive maintenance** scheduling, fuel logs |
| Labour Cost | HR & payroll | Employees, attendance, payroll **generated from attendance** using the workbook formula (rate×days + OT×OT-rate) |
| Risk Register / Issue Log | Governance | Probability×impact scoring, 3×3 heat map, lifecycle states |
| Variation Orders | Variations | Dual DAR/client approval, revised contract & programme impact rollup |
| Daily/Weekly/Monthly Reports | Reports centre | Daily site reports (manpower/equipment lines), **auto-generated** weekly/monthly reports with KPI snapshots, CSV exports |
| — (new) | Documents / Drawings / RFIs / Submittals / NCR / Inspections / Method Statements | Full document control suite |
| — (new) | Safety | Incidents, LTIFR per million man-hours, toolbox talks, training expiry |
| — (new) | **AI Project Assistant** | Answers "Which activities are delaying the project?", "Why is my CPI below 1?", forecasts completion & cash flow, ranks supplier delays, drafts client reports — from live data, optional Anthropic LLM polish |

## Quick start (Docker)

```bash
docker compose up -d --build
# → app:      http://localhost:3000
# → API docs: http://localhost:4000/api/docs
```

Login: `admin@dar-tc.com` / `Admin@123!` (also `john.smith@`, `ahmed.hassan@`,
`sarah.johnson@`, `michael.brown@dar-tc.com` — same password, different roles).

## Local development

```bash
# database
docker compose up -d db          # or any PostgreSQL 16

# backend
cd backend
cp .env.example .env             # adjust DATABASE_URL if needed
npm install
npx prisma migrate dev
npx ts-node prisma/seed.ts       # loads the full workbook dataset
npm run start:dev                # http://localhost:4000  (Swagger at /api/docs)

# frontend
cd ../frontend
npm install
npm run dev                      # http://localhost:3000
```

## Tests

```bash
cd backend && npx jest           # CPM engine + EVM formula suite (validated against workbook figures)
```

## Repository layout

```
backend/            NestJS API — 20 domain modules, Prisma schema (60+ models), seed
  src/modules/      auth, users, companies, parties, projects, scheduling (CPM engine),
                    hr, finance (EVM/cashflow/forecast), procurement, inventory, equipment,
                    governance, quality, safety, documents, reports, analytics,
                    notifications, audit, ai
frontend/           Next.js app — i18n (en/ar/fr + RTL), dashboards, Gantt, 30+ module pages
docs/               Architecture, database/ERD, deployment, user guide
docker-compose.yml  PostgreSQL + API + seed + web
.github/workflows/  CI (build, unit tests, migrate + seed against live PostgreSQL)
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design, module map, security model
- [Database](docs/DATABASE.md) — ER diagram, conventions, migrations & seed
- [Deployment guide](docs/DEPLOYMENT.md) — Docker, environment variables, production hardening
- [User guide](docs/USER_GUIDE.md) — role-by-role walkthrough

## Security

OWASP-aligned: bcrypt (12 rounds), short-lived JWTs + rotating refresh tokens (SHA-256
hashed at rest), full RBAC (6 roles × 26 resources × 6 actions), rate limiting, helmet
headers, class-validator whitelisting, Prisma parameterized queries, upload
extension/size allow-listing, and a complete audit trail of every mutation.
