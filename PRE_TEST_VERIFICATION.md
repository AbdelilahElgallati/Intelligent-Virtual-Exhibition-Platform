# PRE_TEST_VERIFICATION.md — Build Check & Compilation Audit

> Run this checklist **after every task**, without exception.
> Do not mark a task as done until every applicable section passes.
> If a check fails or cannot be verified, say so explicitly — never assume it works.

---

## PART 1 — BACKEND AUDIT (FastAPI / Python)

### 1.1 — Syntax & Import Check

Run these commands from the `backend/` directory before anything else:

```bash
# Activate virtual environment first
cd backend
source venv/bin/activate          # Linux/macOS
# venv\Scripts\activate           # Windows

# Check syntax on every file you touched
python -m py_compile app/main.py
python -m py_compile app/modules/<your_module>/router.py
python -m py_compile app/modules/<your_module>/service.py   # if modified
python -m py_compile app/modules/<your_module>/schemas.py   # if modified

# Verify no import errors on full app startup (dry run)
python -c "from app.main import app; print('✅ App imports OK')"
```

**Expected result:** No output / no errors. Any `SyntaxError` or `ImportError` = STOP, fix before continuing.

---

### 1.2 — Full Dev Server Boot Check

```bash
uvicorn app.main:app --reload --port 8000
```

**Watch for:**
- `✅ Application startup complete` → pass
- Any `ImportError`, `ModuleNotFoundError`, `AttributeError` at startup → STOP

---

### 1.3 — Backend Self-Review Checklist

Answer **YES** or **N/A** for each item. A single **NO** = fix required before done.

| # | Check | Result |
|---|-------|--------|
| 1 | All modified functions use `async/await` correctly | |
| 2 | All Motor DB calls are `await`ed (no sync PyMongo) | |
| 3 | Pydantic models match what the frontend expects (field names + types) | |
| 4 | MongoDB `_id` is serialized to `str` — never returned as `ObjectId` | |
| 5 | Fix works when request comes from Vercel domain (not just localhost) | |
| 6 | File uploads go to Cloudflare R2 — nothing written to local disk | |
| 7 | Any new `.env` variable is listed for manual addition | |
| 8 | HTTP status codes are semantically correct (`201` create, `404` not found, etc.) | |
| 9 | No hardcoded secrets, URLs, or API keys | |
| 10 | No raw `dict` returns — Pydantic models used for all responses | |
| 11 | Daily.co tokens generated server-side only — key never exposed to frontend | |
| 12 | CORS config not broken — Vercel origin still in allowlist | |

---

### 1.4 — Targeted Regression Spot-Checks

Run these quick API calls locally with `curl` or the Swagger UI at `http://localhost:8000/docs`:

```bash
# Health check — must always return 200
curl http://localhost:8000/health

# Auth — token must be returned
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"yourpassword"}'

# Replace <TOKEN> with the token from above for protected routes
curl http://localhost:8000/api/v1/events \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected:** `200 OK` with valid JSON bodies. Any `500`, `422`, or startup crash = STOP.

---

## PART 2 — FRONTEND AUDIT (Next.js / TypeScript)

### 2.1 — TypeScript Compilation Check

Run from the `frontend/` directory:

```bash
cd frontend

# Full TypeScript type-check (no emit) — catches all type errors without building
npx tsc --noEmit

# Expected: zero output = zero errors
# Any error printed = STOP and fix
```

---

### 2.2 — Production Build Check

```bash
cd frontend

# This is the real gate — if Vercel would fail, this will fail too
npm run build
```

**Watch for:**
- `✅ Compiled successfully` → pass
- `Type error` → fix TypeScript before continuing
- `Module not found` → missing import or wrong path
- `ESLint errors` (if `next lint` is configured) → fix before pushing

> **Do not skip this.** Vercel runs `npm run build` on every push. A passing dev server (`npm run dev`) does NOT guarantee a passing build.

---

### 2.3 — Frontend Self-Review Checklist

| # | Check | Result |
|---|-------|--------|
| 1 | `npm run build` passes with zero TypeScript errors | |
| 2 | Component type is correct: Server Component vs Client Component (`"use client"`) | |
| 3 | All API calls go through `src/lib/api/` or `src/services/` — no raw `fetch` in components | |
| 4 | Client-side env variables use `NEXT_PUBLIC_` prefix | |
| 5 | Server-side env variables do NOT use `NEXT_PUBLIC_` prefix | |
| 6 | Fix works when `NEXT_PUBLIC_API_URL` = Hetzner production URL | |
| 7 | No new `any` types introduced (unless pre-existing) | |
| 8 | No hardcoded backend URLs — all via env variables | |
| 9 | Daily.co room logic stays inside dedicated hooks/components | |
| 10 | No `console.log` / debug statements left in committed code | |

---

### 2.4 — Dev Server Smoke Test

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

Manually verify the page(s) you touched:
- Page renders without a white screen or hydration error
- No red errors in browser DevTools console
- Network tab: API calls return `2xx`, not `401`/`500`

---

## PART 3 — SHARED CHECKS (Both Layers)

### 3.1 — Scope Control Gate

Before calling any task done, confirm:

| # | Check | Result |
|---|-------|--------|
| 1 | Change touches ≤ 3 files (if more: was explicit confirmation obtained?) | |
| 2 | No working code was refactored | |
| 3 | No variables, functions, classes, or API endpoints were renamed | |
| 4 | API response shapes are unchanged (backward compatible) | |
| 5 | Auth / JWT logic was NOT modified | |
| 6 | Payment / Stripe logic was NOT modified | |
| 7 | Database field names / schema unchanged (unless explicitly instructed) | |
| 8 | No new external dependencies added without asking | |
| 9 | No reformatting / re-linting of untouched files | |

---

### 3.2 — Shared Utility Impact Check

If you modified a **shared utility, hook, base class, or helper**:

```bash
# Find all files importing the changed module (example)
grep -r "import.*<changed_module>" frontend/src/ --include="*.ts" --include="*.tsx"
grep -r "from.*<changed_module>" backend/app/ --include="*.py"
```

List every caller and confirm none are broken.

---

### 3.3 — Error Path Verification

For every changed function / endpoint, confirm:
- [ ] Happy path works (normal input)
- [ ] Error path works (bad input, missing data, expired token)
- [ ] Expired JWT token does not cause an unhandled `500` — returns `401`

---

### 3.4 — Local vs Production Difference Flag

If behavior may differ between local and production, document it explicitly:

```
⚠️ Local vs Production difference:
- Local:       [describe local behavior]
- Production:  [describe Vercel/Hetzner behavior]
- Reason:      [e.g. missing env var, nginx limit, CORS]
- Action needed on server: [exact commands or config changes]
```

**Always check these common gotchas:**

| Concern | Local default | Production gotcha |
|---------|--------------|-------------------|
| CORS | `localhost:3000` allowed | Vercel domain must be in `CORS_ORIGINS` |
| File upload size | Unlimited | Nginx default = **1 MB** — needs `client_max_body_size 20M` |
| WebSocket | Works by default | Nginx needs `proxy_set_header Upgrade $http_upgrade` |
| Env vars | `.env.local` | Must be set in Vercel dashboard / Hetzner `.env` |
| MongoDB pool | Single connection fine | M10 pool exhaustion under load |
| `NEXT_PUBLIC_` vars | `.env.local` | Must be re-added in Vercel env settings |

---

## PART 4 — PRODUCTION DEPLOYMENT CHECKS

Only run these when pushing to production.

### 4.1 — Vercel (Frontend)

```bash
# Vercel CLI pre-check (optional but recommended)
npx vercel build   # simulates Vercel build environment locally
```

Verify in Vercel dashboard after deploy:
- Build logs show `✅ Build Completed`
- No `Type error` or `Module not found` in build output
- Environment variables are set (check Settings → Environment Variables)
- Preview URL loads correctly before promoting to production

---

### 4.2 — Hetzner / Nginx (Backend)

SSH into the server and run:

```bash
# Restart backend via PM2
pm2 restart all
pm2 logs --lines 50          # watch for startup errors

# Check Nginx config is valid before reloading
sudo nginx -t
sudo systemctl reload nginx

# Confirm backend is responding through Nginx
curl https://<your-domain>/health
```

**Expected:** `{"status": "ok"}` or equivalent. Any `502 Bad Gateway` = PM2 process crashed, check `pm2 logs`.

---

### 4.3 — Post-Deploy Smoke Test (Production)

Run through this after every production deploy:

```bash
# 1. Health endpoint
curl https://<your-domain>/health

# 2. Auth still works (replace with real test credentials)
curl -X POST https://<your-domain>/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"yourpassword"}'

# 3. Public event listing (no auth)
curl https://<your-domain>/api/v1/events
```

Then manually open the production Vercel URL and verify:
- Login page loads
- You can log in and reach the dashboard
- No `Mixed Content` warnings in browser console (HTTP vs HTTPS)

---

## PART 5 — KNOWN PITFALLS (Do Not Repeat)

These mistakes have already been made. Check them explicitly on relevant tasks:

| # | Pitfall | Where to check |
|---|---------|---------------|
| 1 | `client_max_body_size` not set in Nginx → `413` on PDF upload | `/etc/nginx/sites-available/<config>` |
| 2 | Nginx missing WebSocket headers → WS connection fails | `proxy_set_header Upgrade $http_upgrade` in nginx config |
| 3 | Sync PyMongo used instead of async Motor in route handler | grep `from pymongo` in any router file you touched |
| 4 | MongoDB `ObjectId` returned directly in response | All `_id` fields must be `str(doc["_id"])` |
| 5 | Frontend env var missing `NEXT_PUBLIC_` prefix → `undefined` in browser | Check all `process.env.*` in client components |
| 6 | Meeting logic applied to wrong role (sender vs receiver) | Re-read role assignment before fixing meeting/approval flows |
| 7 | Daily.co API key exposed to frontend | Key must only appear in backend `.env` — never in `NEXT_PUBLIC_*` |
| 8 | Wildcard `*` in CORS for production | `CORS_ORIGINS` must list explicit Vercel domain(s) |
| 9 | R2 public URL confused with R2 API endpoint | `R2_PUBLIC_BASE_URL` ≠ `R2_ENDPOINT` — check both |
| 10 | Server Component using React hooks or browser APIs | Add `"use client"` at top of file if hooks are needed |

---

## QUICK REFERENCE — COMMANDS AT A GLANCE

```bash
# ── BACKEND ──────────────────────────────────────────────
cd backend && source venv/bin/activate

# Syntax check (replace with actual file paths)
python -m py_compile app/modules/<module>/router.py

# Full import check
python -c "from app.main import app; print('✅ OK')"

# Start dev server
uvicorn app.main:app --reload

# ── FRONTEND ─────────────────────────────────────────────
cd frontend

# Type check (no build output)
npx tsc --noEmit

# Production build (must pass before any push)
npm run build

# Start dev server
npm run dev

# ── PRODUCTION ───────────────────────────────────────────
# Backend (on Hetzner server)
pm2 restart all && pm2 logs --lines 50
sudo nginx -t && sudo systemctl reload nginx
curl https://<your-domain>/health

# Frontend (local Vercel simulation)
npx vercel build
```

---

## TASK COMPLETION SIGN-OFF TEMPLATE

Copy and fill this out at the end of every task:

```
## ✅ Task Sign-Off

**Task:** [brief description]
**Files modified:** 
  - path/to/file1 → what changed
  - path/to/file2 → what changed

**Files NOT touched:** [list anything adjacent that was intentionally left alone]

**Build checks passed:**
  - [ ] python -m py_compile → no errors
  - [ ] python -c "from app.main import app" → no errors
  - [ ] npx tsc --noEmit → 0 errors
  - [ ] npm run build → compiled successfully

**Self-review checklists:** backend ✅ / frontend ✅ / shared ✅

**To verify manually:**
1. Run: [exact command]
2. Go to: [exact URL]
3. Do: [exact action]
4. Expect: [exact result]
5. Also check: [regression risk]

⚠️ Local vs Production difference: [none | describe if any]

**New env variables needed:** [none | list with example values]
```

---

> Last updated: 2026-04-12
> Source: GEMINI.md + GEMINI_verification_protocol.md + PROJECT_CONTEXT.md
> Repo: https://github.com/AbdelilahElgallati/Intelligent-Virtual-Exhibition-Platform
