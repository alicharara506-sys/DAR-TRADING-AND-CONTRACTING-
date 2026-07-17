# Beginner Setup Guide — Run the DAR ERP on your computer

This guide assumes **zero programming knowledge**. Follow it top to bottom.
It is written for **Windows 10/11**; Mac differences are noted where they exist.

---

## Part 1 — Install the tools (one time only)

### 1.1 Install VS Code (the code editor)
1. Go to https://code.visualstudio.com
2. Click **Download for Windows** (or Mac), open the downloaded file, click Next until finished.
   - On Windows, tick **"Add to PATH"** if asked.

### 1.2 Install Git (downloads the project)
1. Go to https://git-scm.com/downloads and download for your system.
2. Run the installer. Click **Next** on every screen (the defaults are fine).

### 1.3 Install Node.js (runs the project's code)
1. Go to https://nodejs.org
2. Download the **LTS** version (the green button, version 20 or 22).
3. Run the installer, click Next until finished.

### 1.4 Install Docker Desktop (runs the database)
1. Go to https://www.docker.com/products/docker-desktop and download.
2. Run the installer. If it asks about **WSL 2**, keep it ticked.
3. **Restart your computer** after installing.
4. Open **Docker Desktop** from the Start menu and wait until it says
   **"Engine running"** (bottom-left, green). Leave it open in the background.

### 1.5 Verify everything installed
Open VS Code → menu **Terminal → New Terminal**. Type each line and press Enter:

```
git --version
node --version
npm --version
docker --version
```

Each line must print a version number (e.g. `v22.11.0`). If one says
*"not recognized"*, close VS Code completely and open it again (or restart the PC).

---

## Part 2 — Download the project

In the VS Code terminal, run these one at a time:

```
cd %USERPROFILE%\Documents
git clone https://github.com/alicharara506-sys/DAR-TRADING-AND-CONTRACTING-.git dar-erp
cd dar-erp
git checkout claude/construction-erp-platform-kfqdmg
```

(On Mac, use `cd ~/Documents` for the first line.)

Then open the folder in VS Code: menu **File → Open Folder…** →
choose `Documents\dar-erp` → **Select Folder**. If VS Code asks
"Do you trust the authors?", click **Yes, I trust**.

> When you reopen the folder, open a fresh terminal with **Terminal → New Terminal**.

---

## Part 3 — Easiest way to run: Docker (recommended)

With Docker Desktop **running** (green engine), type in the VS Code terminal:

```
docker compose up -d --build
```

The **first time takes 5–15 minutes** (it downloads and builds everything).
Wait until the terminal gives you the prompt back, then wait ~1 more minute.

Open your browser at:

- **The application:** http://localhost:3000
- **API documentation:** http://localhost:4000/api/docs

Log in with:

| Email | Password |
|---|---|
| `admin@dar-tc.com` | `Admin@123!` |

Other demo users (same password): `john.smith@dar-tc.com` (Project Manager),
`ahmed.hassan@dar-tc.com` (QS), `sarah.johnson@dar-tc.com` (Finance),
`michael.brown@dar-tc.com` (Site Engineer).

**To stop the app:** `docker compose down`
**To start it again later:** open Docker Desktop, then `docker compose up -d`
(fast after the first time — your data is kept).

If Docker worked, **you are done**. Part 4 is only for running it the manual
"developer" way.

---

## Part 4 — Manual way (developer mode, without full Docker)

Use this if you want to change the code and see updates instantly.
You still use Docker for the **database only**.

### 4.1 Start the database
```
docker compose up -d db
```

### 4.2 Set up the backend (API)
```
cd backend
copy .env.example .env
npm install
npx prisma migrate deploy
npx ts-node prisma/seed.ts
npm run start:dev
```
(On Mac use `cp .env.example .env` instead of `copy`.)

- `npm install` downloads all libraries the backend uses (NestJS, Prisma, etc.) — takes a few minutes.
- `prisma migrate deploy` creates all database tables.
- `seed.ts` fills the database with the DAR project data from the Excel workbook.
- `start:dev` starts the API. Success looks like:
  `🏗 DAR ERP API running on http://localhost:4000`

**Leave this terminal running.**

### 4.3 Start the frontend (website)
Open a **second** terminal (**Terminal → New Terminal**):

```
cd frontend
npm install
npm run dev
```

When it says `Ready`, open http://localhost:3000 and log in as above.

**To stop either one:** click its terminal and press `Ctrl + C`.
**To run again later:** start Docker Desktop, then
`docker compose up -d db`, then repeat `npm run start:dev` (backend terminal)
and `npm run dev` (frontend terminal). You do **not** repeat install/migrate/seed.

---

## Part 5 — Problems and fixes

| Problem | Fix |
|---|---|
| `'docker' is not recognized` | Docker Desktop is not installed or PC not restarted. Install it, restart, make sure Docker Desktop shows "Engine running". |
| `'node' / 'npm' is not recognized` | Reinstall Node.js LTS, then close and reopen VS Code. |
| `port is already allocated` / `address already in use` | Something else uses port 3000 or 4000. Restart your computer and try again. |
| Docker build fails with a network error | Check your internet, then run `docker compose up -d --build` again — it resumes. |
| Login page loads but login fails | The database seed hasn't finished. Wait a minute; with Docker run `docker compose logs seed` to check. In manual mode make sure step 4.2's seed command printed `✅ Seed complete`. |
| Page is blank / errors in browser | Make sure BOTH the backend (port 4000) and frontend (port 3000) are running. |
| `P1001: Can't reach database server` | The database isn't running: `docker compose up -d db` and wait 20 seconds. |

---

## What the pieces are (plain language)

- **Frontend** (`frontend/` folder) — the website you see, built with **Next.js/React**.
- **Backend** (`backend/` folder) — the "brain" (API) that does the calculations
  (schedules, budgets, payroll…), built with **NestJS**.
- **Database** (PostgreSQL, inside Docker) — where all data is stored.
- **`npm install`** — reads the project's `package.json` and downloads every library
  it needs automatically. You never install libraries one by one.
- **Docker** — runs software in ready-made boxes so you don't have to install and
  configure PostgreSQL yourself.
