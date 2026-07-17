# Architecture

## Overview

```
┌────────────┐   HTTPS    ┌───────────────┐   Prisma    ┌──────────────┐
│  Next.js   │ ─────────▶ │   NestJS API  │ ──────────▶ │ PostgreSQL 16 │
│  (web)     │  /api/v1/* │  20 modules   │             │  60+ tables   │
└────────────┘  (rewrite) └───────┬───────┘             └──────────────┘
                                  │ optional
                                  ▼
                          Anthropic API (AI assistant enrichment)
```

- The frontend proxies `/api/v1/*` to the API via a Next.js rewrite, so the browser
  talks to a single origin (no CORS in production, CSRF surface minimised — JWTs are
  sent via `Authorization` header, never cookies).
- The API is a modular monolith: each business domain is an isolated NestJS module
  behind global guards (JWT → RBAC) and a global audit interceptor.

## Backend module map

| Module | Responsibilities | Key logic |
|---|---|---|
| auth | login, refresh rotation, me, change password | bcrypt, SHA-256 refresh hashes, session revocation |
| users | users, roles, permissions | RBAC matrix management |
| companies | company profile & settings | |
| parties | clients/consultants/contractors/suppliers | supplier performance (avg delivery delay, spend) |
| projects | projects, milestones, members | budget-weighted progress rollup |
| **scheduling** | WBS, tasks, dependencies, baselines, allocations | **CPM engine** (`cpm.engine.ts`, pure & unit-tested): topological sort with cycle detection, forward/backward pass for FS/SS/FF/SF + lag, total/free float, critical path; delay analysis vs baseline; resource histogram |
| hr | employees, attendance, payroll, training | payroll generated from attendance (dailyRate×days + otHours×otRate), posts to cost ledger on approval |
| **finance** | cost codes, budget, cost ledger, EVM, cash flow, invoices, BOQ, estimates, forecast | **EVM computed live**: PV from baseline linear earning, EV from budget×progress, AC from ledger; EAC blending (60% EVM + 40% least-squares burn-rate regression); invoice VAT/retention/advance from contract terms |
| procurement | PR → RFQ → quotations → PO → GRN | weighted vendor comparison; award auto-drafts PO; GRN posts stock + PO status |
| inventory | materials, warehouses, stock ledger, material requests | transactional stock updates with availability checks |
| equipment | fleet, assignments, maintenance, fuel | preventive maintenance auto-reschedule, daily overdue cron |
| governance | risks, issues, variation orders | risk score = probability × impact; VO contract revision rollup |
| quality | NCRs, inspections, method statements | first-time-pass rate |
| safety | incidents, toolbox talks | LTIFR per 1,000,000 man-hours from attendance |
| documents | DMS uploads, drawings, RFIs, submittals | extension/size allow-list, disk storage, versioned drawings |
| reports | daily site reports, weekly/monthly generation, CSV exports, productivity | reports assembled from live EVM/tasks/risks |
| analytics | executive & project dashboards, KPIs, global search | portfolio health scoring |
| notifications | user notifications, broadcast | |
| audit | audit trail query API | written by global interceptor on every mutation |
| ai | AI Project Assistant | intent classifier (12 intents, en/ar/fr patterns) → deterministic insight engine over live data → optional Anthropic LLM rewrite (graceful without key) |

## Frontend architecture

- **App Router** with `[locale]` segment; middleware redirects `/` → `/{locale}` from a
  cookie. `ar` renders `dir="rtl"` with an Arabic type family.
- **i18n**: static dictionaries (en/ar/fr) via a context provider; all numbers, dates and
  currency formatted with `Intl` per locale (Arabic numerals render natively).
- **Data layer**: React Query + a fetch client with silent refresh-token rotation and
  401 redirect.
- **CrudPage / DataTable**: config-driven module pages (columns + form fields) give every
  ERP entity list/search/sort/paginate/create/edit/delete behaviour with ~50 lines each.
- **Gantt**: custom SVG renderer — month grid, baseline ghost bars, progress fill,
  dependency arrows, critical-path colouring, today marker, hover cards.
- Dark mode (`next-themes`), framer-motion page/modal transitions, WCAG-visible focus
  rings, keyboard `⌘K` global search.

## Security model

1. **Authentication** — short-lived access JWT (15 min) + rotating refresh tokens stored
   as SHA-256 hashes with revocation; password change revokes all sessions.
2. **Authorization** — `PermissionsGuard` enforces `@RequirePermission(resource, action)`
   per route against the role's permission set (6 seeded roles, ADMIN wildcard).
3. **Input** — global `ValidationPipe` (whitelist + transform), Prisma parameterized queries.
4. **Transport/headers** — helmet, CORS allow-list, rate limiting (300 rpm default,
   10 rpm login).
5. **Uploads** — extension allow-list, size cap, randomized filenames outside web root.
6. **Audit** — every mutating request persisted (user, action, resource, sanitized body, IP).

## Performance

- Server pagination on heavy lists; client virtual pagination elsewhere.
- Indexed foreign keys and hot filters (status, dates, codes) in Prisma schema.
- React Query caching (30 s stale), code-splitting per route (Next.js), standalone output.
- Background jobs via `@nestjs/schedule` (maintenance overdue flagging).
