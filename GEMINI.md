# GEMINI.md — Intelligent Virtual Exhibition Platform

> This file is the single source of truth for the AI agent operating in this repository.
> Read it fully before touching any file. No exceptions.

@./PROJECT_CONTEXT.md
@./GEMINI_verification_protocol.md
@.gemini/commands/commands.md
@./PRE_TEST_VERIFICATION.md


---

## Project Overview

A scalable, immersive virtual exhibition platform for hosting professional online expos, trade
fairs, and networking events. It supports real-time video, lead generation, file storage, and
analytics — all deployable worldwide.

---

## Architecture & Stack

### Monorepo Layout

```
/
├── frontend/          # Next.js 14+ (TypeScript) — deployed on Vercel
├── backend/           # FastAPI (Python) — deployed on Hetzner
├── Ressources/        # Static project assets
├── PROJECT_CONTEXT.md # project goals, user stories, business rules
```

### Frontend — `frontend/`

| Concern | Technology |
|---|---|
| Framework | Next.js 14+ (App Router), TypeScript |
| Styling | Tailwind CSS |
| State | React hooks / context |
| Real-time video | Daily.co SDK (WebRTC) |
| Auth | JWT (via backend API) |
| Deploy | Vercel |

### Backend — `backend/`

| Concern | Technology |
|---|---|
| Framework | FastAPI (Python 3.11+) |
| Database | MongoDB (Motor async driver) |
| File storage | Cloudflare R2 (S3-compatible) |
| Real-time video | Daily.co REST API + Python SDK |
| Auth | JWT tokens |
| Deploy | Hetzner VPS |

### External Services

| Service | Purpose |
|---|---|
| MongoDB Atlas | Primary database |
| Cloudflare R2 | Media/file storage |
| Daily.co | WebRTC video conferencing |
| Vercel | Frontend hosting + edge |
| Hetzner | Backend VPS hosting |

---

## CRITICAL Operating Rules

### The Golden Rule

> **Fix ONLY what is explicitly asked. Make the MINIMAL change that solves the problem.**

### Absolute Prohibitions

- **DO NOT** refactor working code, ever
- **DO NOT** rename variables, functions, classes, or API endpoints
- **DO NOT** change API response shapes unless the task explicitly requires it
- **DO NOT** modify authentication logic (JWT generation, validation, middleware)
- **DO NOT** modify payment logic or any billing-related code
- **DO NOT** change database schema/field names without explicit instruction
- **DO NOT** swap or upgrade libraries/dependencies unprompted
- **DO NOT** add logging, comments, or docstrings to code you weren't asked to touch
- **DO NOT** reformat or re-lint files you were not asked to change

### Scope Control

- If a fix touches **more than 3 files** → **STOP, list them, and ask for confirmation**
- If a fix requires a **database migration** → **STOP and describe the migration first**
- If a fix changes a **shared utility or base class** → **STOP and list all affected callers**
- If you are uncertain which layer owns a behavior → **ASK before guessing**

---

## Required Workflow — Before Every Change

1. **State** the exact files you plan to modify (full paths)
2. **Explain** what you will change in each file and why
3. **Flag** any side effects or risks (e.g., "this touches a shared helper used by 4 routes")
4. **Wait** for explicit confirmation before writing any code
5. **After the change**, briefly confirm what was done and what was NOT touched

Example pre-change statement:
```
Files to modify:
  - backend/routers/exhibitions.py  → add pagination query params to GET /exhibitions
  - backend/schemas/exhibition.py   → add PaginatedResponse schema

No changes to: auth, database models, existing response fields, frontend.
Confirm?
```

---

## Code Quality Standards

### Universal

- Production-grade code only — no TODOs, no `# temporary`, no `console.log` left in
- Every change must work in **both local dev and production** (Vercel + Hetzner)
- Maintain **full backward compatibility** — existing clients must not break
- Match the existing code style exactly (indentation, naming conventions, import order)
- No new external dependencies without asking first

### Backend (FastAPI / Python)

- Use `async`/`await` consistently — this is an async codebase (Motor, FastAPI)
- Pydantic models for all request bodies and responses — no raw `dict` returns
- HTTP status codes must be semantically correct (`201` for create, `404` for not found, etc.)
- Never expose raw MongoDB `_id` ObjectIds to the API — serialize to strings
- Environment variables via `.env` / `os.getenv` — never hardcode secrets or URLs
- File uploads go through Cloudflare R2 — never write to local disk in production
- Daily.co token generation must use the server-side SDK — never expose Daily.co secrets to frontend

### Frontend (Next.js / TypeScript)

- Strict TypeScript — no `any` types unless pre-existing
- API calls centralized in a service/api layer — no raw `fetch` scattered in components
- Environment variables via `NEXT_PUBLIC_` prefix for client-side, plain for server-side
- Daily.co room logic stays in dedicated hooks/components — not mixed into page logic
- No hardcoded backend URLs — use environment variables

---

## Domain Knowledge

### Core Entities

| Entity | Description |
|---|---|
| `Exhibition` | A virtual expo event with metadata, schedule, and hosted stands |
| `Stand` | A virtual booth within an exhibition, owned by an exhibitor |
| `User` | Can be Admin, Organizer, Exhibitor, or Visitor |
| `Product` | An item listed within a Stand |
| `Meeting` | A scheduled video session between visitor and exhibitor (via Daily.co) |
| `Lead` | A captured contact/interest generated during the event |
| `Media` | Files/images stored in Cloudflare R2, referenced by URL |

### User Roles

```
Admin      → manages platform
Organizer  → creates and manages exhibitions
Exhibitor  → owns one or more stands within an exhibition
Visitor    → browses exhibitions, views stands, schedules meetings
```

### Video / Real-time

- Daily.co handles all WebRTC video via REST API room creation
- Rooms are scoped to individual Meetings
- Daily.co room tokens/meeting links are generated server-side by FastAPI and handed to the frontend
- Never expose the Daily.co API key to the frontend

### File Storage

- All uploads (images, documents, product media) are stored in **Cloudflare R2**
- Files are referenced by their public R2 URL in MongoDB documents
- Use presigned URLs or direct upload patterns — do not proxy large files through FastAPI

---

## Environment Variables Reference

### Backend (`backend/.env`)

```
DATABASE_NAME=
MONGO_URI=
JWT_SECRET=
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
REFRESH_TOKEN_EXPIRE_DAYS=7
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
R2_PUBLIC_BASE_URL=
DAILY_API_KEY=
DAILY_DOMAIN=
CORS_ORIGINS=
FRONTEND_URL=
ENV=dev
DEBUG=true
API_V1_STR=
APP_NAME="Intelligent Virtual Exhibition Platform"
```

### Frontend (`frontend/.env.local`)

```
NEXT_PUBLIC_DAILY_DOMAIN=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=
NEXT_PUBLIC_R2_PUBLIC_BASE_URL=
```

---

## Common Pitfalls — Do Not Repeat

- **MongoDB ObjectId**: Always convert `_id` to `str` in Pydantic models; Motor returns `ObjectId` objects
- **CORS**: Backend CORS origins are configured for Vercel domain(s) — don't add wildcard `*` in production
- **Daily.co room names**: Must be unique per Meeting — use Meeting ID as room name; rooms should be deleted after the meeting ends to stay within plan limits
- **R2 URLs**: R2 public URLs differ from the API endpoint URL — check both `R2_ENDPOINT` vs `R2_PUBLIC_BASE_URL`
- **Async in FastAPI**: All DB calls use `await` with Motor — never use synchronous PyMongo in route handlers
- **Next.js App Router**: Server Components cannot use browser APIs or React hooks — check component type before adding interactivity

---

## Gemini CLI Session Rules

### How to start a session
Always tell me what you are working on today:
- Which feature or bug
- Which role is affected (visitor / exhibitor / organizer / admin)
- Whether it is frontend, backend, or both

### Useful in-session commands
- `/memory add <note>` — save a discovery permanently (e.g. "Daily.co room deletion is fixed")
- `/restore` — undo any file Gemini modified (checkpointing is always on)
- `/compress` — compress context if the session gets very long
- `/chat save <name>` — save session to resume later

### When to stop and ask
- Any change that touches auth, payments, or database schemas
- Any change affecting more than 3 files
- Anything that would break the existing API contract for the frontend

---

## File Reference Map

| File | Purpose |
|---|---|
| `PROJECT_CONTEXT.md` | High-level project goals, user stories, business rules |
| `docs/backend_api_guide.md` | API endpoint reference (routes, methods, payloads) |
| `docs/backend_implementation_details.md` | Implementation notes, architectural decisions |
| `GEMINI.md` (this file) | AI agent operating rules — read first, always |

> When in doubt about business logic or API contracts, consult `PROJECT_CONTEXT.md`