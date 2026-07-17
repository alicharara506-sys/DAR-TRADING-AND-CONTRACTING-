# User Guide

## Signing in

Open the app (default `http://localhost:3000`). Demo accounts (password `Admin@123!`):

| Account | Role | Sees |
|---|---|---|
| admin@dar-tc.com | ADMIN | everything incl. users, settings, audit |
| john.smith@dar-tc.com | PROJECT_MANAGER | projects, schedule, site, procurement, approvals |
| ahmed.hassan@dar-tc.com | QUANTITY_SURVEYOR | BOQ, estimation, variations, cost control |
| sarah.johnson@dar-tc.com | FINANCE_CONTROLLER | finance, invoices, payments, payroll |
| michael.brown@dar-tc.com | SITE_ENGINEER | daily reports, progress, materials, QHSE |
| client@abc-realestate.com | VIEWER | read-only portal |

Use the globe icon to switch **English / العربية / Français** (Arabic flips the whole
layout to RTL); the moon icon toggles dark mode; `⌘K`/`Ctrl-K` opens global search.

## Daily workflows

**Project managers** — open *Projects → your project*: the dashboard shows progress, CPI/SPI,
S-curve and milestones. In *Schedule & Gantt*: update task progress, then **Run CPM** to
recompute the critical path and forecast finish; **Save Baseline** before approving scope
changes; the *Delay Analysis* tab ranks slipping activities (critical-path first).

**Quantity surveyors** — maintain *BOQ* items (amounts auto-compute), raise *Variation Orders*
(VAT auto-added, contract summary updates on client approval), watch *Cost Control* for
over-running cost codes and the blended AI cost prediction.

**Finance** — *Client Invoices*: enter the net amount and the platform applies the contract's
VAT, retention and advance-recovery automatically; receipts flip status to paid and feed cash
flow. *Payroll*: pick a month and **Generate** — pay is computed from attendance; approving
posts the total to the project's labour cost code.

**Procurement** — raise a PR, source it via RFQ, record quotations, open the **comparison
matrix** (weighted price/delivery/rating score) and award — a draft PO is created
automatically. Receiving goods against the PO posts stock into the warehouse ledger.

**Site engineers** — file the *Daily Report* (weather, manpower by trade, equipment hours,
work done, safety notes); raise *RFIs*, *NCRs* and *Inspection Requests*; log incidents —
LTIFR is computed from attendance man-hours.

**Everyone** — ask the **AI Assistant**: *"Which activities are delaying the project?"*,
*"Forecast project completion"*, *"Why is my CPI below 1?"*, *"Predict cash flow"*,
*"Which supplier causes the highest delays?"*, *"Generate weekly report"*, *"Write client
progress report"* — answers are computed from your live project data.

## Reports & exports

*Progress Reports* generates complete weekly/monthly reports (executive summary, KPIs,
activities, risks) in one click. Any project dataset (tasks, cost control, invoices, risks,
POs, material movements) exports to CSV from its page or via
`GET /api/v1/projects/:id/exports/:dataset`. Swagger for the whole API: `/api/docs`.
