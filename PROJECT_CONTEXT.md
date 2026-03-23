# PROJECT_CONTEXT.md - Intelligent Virtual Exhibition Platform (IVEP)

Generated: 2026-03-23
Purpose: Full, code-verified project context snapshot up to current state, including the latest production deployment architecture and API provider swaps.

---

## 1) Executive Summary

IVEP is a multi-role virtual exhibition platform that combines event management, enterprise stands, audience interaction, analytics, and AI-powered capabilities.

Primary personas:
- Admin
- Organizer
- Enterprise
- Visitor

Core capability areas:
- Event lifecycle and approval workflows
- Paid/free participation flows
- Virtual stands and product marketplace
- Real-time communication (chat, meetings, conferences)
- AI assistant (RAG), translation, and transcription
- Governance and operations (audit, incidents, monitoring)

---

## 2) Current Workspace Structure (Top-Level)

Main workspace root:
- `backend/` - FastAPI backend (API, modules, workers, data, uploads)
- `frontend/` - Next.js frontend (App Router, role-based portals)
- `PROJECT_CONTEXT.md` - this context file
- `backend_api_guide.md`, `backend_implementation_details.md`, `discution_about_project.md`
- `fix_*.py` helper/fix scripts used during iterative maintenance
- `Ressources/`

Backend notable folders:
- `backend/app/` application package
- `backend/app/modules/` domain modules
- `backend/data/chroma_db/` local vector DB storage
- `backend/uploads/` uploaded files (enterprise profile, payments, resources, product images)
- `backend/scripts/` scripts (including test data seeding)

Frontend notable folders:
- `frontend/src/app/` route tree (public + admin/organizer/enterprise groups)
- `frontend/src/components/`, `src/context/`, `src/hooks/`, `src/services/`, `src/types/`, `src/lib/`

---

## 3) Technology Stack

### Backend
- Python 3.10+
- FastAPI + Uvicorn
- MongoDB (async access, M10 Atlas cluster)
- JWT auth + RBAC
- Stripe for payments (event ticket + marketplace checkout, Test Keys)
- Daily.co integration for real-time video/conferences
- Cloudflare R2 integration for bucket storage
- AI stack components for RAG, translation, transcription

### Frontend
- Next.js App Router (TypeScript)
- React
- Tailwind CSS + component system
- Client API/service layer abstraction
- Pages for public, admin, organizer, and enterprise experiences

---

## 3.5) Production Deployment Architecture

- **Frontend:** Deployed on Vercel Edge Network (`NEXT_PUBLIC_API_URL` pointing to backend).
- **Backend:** Deployed on Hetzner Cloud VPS (Ubuntu). Python environment managed via `venv` and processes daemonized using **PM2** (`pm2 start uvicorn`). Exposed securely via **Nginx** reverse proxy and Certbot SSL.
- **Database:** MongoDB Atlas (M10 Dedicated Cluster).
- **Storage:** Cloudflare R2 (S3/boto3 integration).
- **Video API:** Daily.co (Switched seamlessly from LiveKit).
- **Payments:** Stripe (Webhook configured fully globally on `/api/v1/webhook`).

---

## 4) Backend Application Architecture

Main entrypoint:
- `backend/app/main.py`

Startup lifecycle:
1. Configure logging
2. Connect to MongoDB
3. Ensure DB indexes
4. Start background lifecycle task (`lifecycle_loop()`)

Shutdown lifecycle:
1. Cancel lifecycle background task
2. Close MongoDB connection

Infrastructure configuration:
- CORS allowlist includes localhost and LAN dev origins on ports 3000/3001
- Static mounting: `/uploads` -> `backend/uploads`

Health/root endpoints:
- `GET /` returns welcome message
- `GET /health` returns health status

---

## 5) Backend Router Registration (Current Reality)

All primary routers are mounted under API prefix (default `/api/v1`).

Mounted core routers:
- auth
- users
- organizations
- events
- participants
- stands
- analytics
- notifications
- favorites
- admin
- audit
- incidents
- payments
- marketplace
- monitoring
- sessions
- organizer_report
- enterprise
- conferences

Mounted legacy/extra routers with explicit sub-prefixes:
- `/chat`
- `/assistant`
- `/translation`
- `/transcripts`
- `/meetings`
- `/resources`
- `/leads`
- `/recommendations`

Conditional router:
- `dev` router only when environment is dev or debug is enabled

Important current note:
- subscriptions module router exists in codebase but is commented/disabled in `main.py` and therefore not active in runtime routing.

---

## 6) Backend Modules Inventory

Modules present in `backend/app/modules/`:
- admin
- ai_rag
- ai_translation
- analytics
- audit
- auth
- chat
- conferences
- dev
- enterprise
- events
- favorites
- incidents
- leads
- marketplace
- meetings
- monitoring
- notifications
- organizations
- organizer_report
- participants
- payments
- recommendations
- resources
- sessions
- stands
- subscriptions
- transcripts
- users

Router coverage:
- 29 module routers currently exist under `backend/app/modules/**/router.py`
- all major business modules are routable except subscriptions (present but currently disabled in app registration)

---

## 7) Key Domain Flows and Features

### Authentication and Access
- Role-based authentication and authorization for admin/organizer/enterprise/visitor
- Token-based auth with dependency guards

### Events and Participation
- Event creation and moderation lifecycle
- Participant invitation/request/approval flows
- Event lifecycle transitions (approval, live, close)

### Payments
- Event ticket checkout and verification endpoints in payments module
- Global webhook endpoint (`/webhook`) handling Stripe `checkout.session.completed` events
- Stripe-backed payment sessions and payment status checks (using Test API keys)

### Enterprise Ecosystem
- Enterprise profile and media management
- Product catalog and product requests
- Enterprise event participation and stand management

### Conferences, Meetings, and Real-Time
- Conference create/manage/start/end with role-specific operations
- Meeting booking and meeting room experiences
- Chat and monitoring websocket-enabled experiences

### AI and Knowledge Features
- AI assistant (RAG query/ingest/stats flows)
- Translation endpoints
- Transcription endpoints (including websocket-related flows)
- Recommendation endpoints and interaction logging

### Governance and Operations
- Audit logs and action tracking
- Incident/content flag management
- Live monitoring metrics endpoints

---

## 8) Frontend Architecture and Route Coverage

Primary app structure:
- Root app router under `frontend/src/app`
- Role-separated route groups:
  - `(admin)`
  - `(organizer)`
  - `(enterprise)`

Public/common routes include:
- landing page
- auth (login/register)
- events list and event details
- event live pages and stand detail pages
- event payment page
- dashboard/profile/favorites/assistant/webinars
- meetings room page

Admin pages include:
- dashboard
- users, organizations, subscriptions, payments
- incidents, audit, monitoring
- events list/detail, per-event sessions, monitoring, enterprises, organizer report
- analytics overview and per-event analytics
- organizer registrations and event join requests

Organizer pages include:
- dashboard
- event list/new/detail/analytics
- profile, notifications, subscription

Enterprise pages include:
- dashboard, profile, notifications, communications
- events list and per-event manage/stand/analytics/conferences/live pages
- products and product requests
- leads and analytics
- conferences overview

Marketplace frontend route status:
- `frontend/src/app/marketplace/success/page.tsx` exists
- `frontend/src/app/marketplace/cancel/page.tsx` exists
- `frontend/src/app/marketplace/page.tsx` is still not present

Current route density signal:
- 61 `page.tsx` files found under `frontend/src/app/**/page.tsx`

---

## 9) Frontend Data/API Layer Snapshot

API client and endpoint layers exist in:
- `frontend/src/lib/http.ts`
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/api/endpoints.ts`

Service layer currently includes (non-exhaustive):
- auth service
- events service
- favorites service
- assistant service
- admin service
- organizer service

Known placeholder service/hook areas still present:
- `chat.service.ts`
- `stands.service.ts`
- `useChat.ts`
- `useEvents.ts`
- `useNotifications.ts`
- `useStands.ts`

---

## 10) Data, Assets, and Runtime Storage

Persistent and media storage seen in workspace:
- `backend/data/chroma_db/` for local embedding/vector data persistence
- `backend/uploads/` for user and business uploads
  - enterprise profile assets
  - payment-related uploads
  - product images
  - resources

---

## 11) Current Development Notes

Backend local boot baseline:
1. Create and activate virtual environment
2. Install requirements
3. Run backend with Uvicorn

Frontend local boot baseline:
1. Install Node dependencies
2. Configure environment (API base URL)
3. Run development server

Observed in workspace context:
- Multiple fix scripts indicate ongoing iterative stabilization on routers/payment/webhook/service paths.

---

## 12) Known Gaps / Technical Debt (Current)

- subscriptions router is present but not mounted in backend application registration
- some frontend hooks/services are placeholders and may not yet be wired to complete flows
- marketplace landing/index route is absent (only success/cancel routes exist)

---

## 13) Change Log (Latest Verified Modifications)

### 2026-03-18 - Backend startup ImportError fix

Issue observed during backend startup:
- ImportError in payments router: attempted to import `_configure` from marketplace stripe service, but symbol did not exist.

Applied modification:
- In `backend/app/modules/payments/router.py`, removed invalid/unused import:
  - `from app.modules.marketplace.stripe_service import _configure as _stripe_configure`

Validation performed:
- Direct module import check succeeded:
  - `import app.modules.payments.router`
- Confirms previous startup blocker was removed.

### Context correction included in this snapshot

Updated documentation statement:
- Frontend marketplace route folder exists with success and cancel pages.
- There is still no standalone marketplace index page.

---

## 14) Reference Files for Ongoing Maintenance

Primary reference files:
- `PROJECT_CONTEXT.md` (this document)
- `backend_api_guide.md`
- `backend_implementation_details.md`
- `docs/backend_routes_postman.md`

Operationally useful scripts/docs in root:
- `fix_*.py` scripts (hotfix helpers)
- payload samples for login/registration under `backend/`

---

This snapshot is intended to be maintained as the single source of truth for current structure, implemented capabilities, and recently applied changes.

Important state note:
- `src/types/chat.ts` exists but is currently empty.

---

## 8. AI and Real-time Capabilities

### AI Assistant (RAG)

Module: `backend/app/modules/ai_rag`

- scope-based query and ingestion
- vector retrieval + DB facts retrieval
- streaming and source-attributed responses

### Translation

Module: `backend/app/modules/ai_translation`

- language detection endpoint
- translation endpoint

### Transcription

Module: `backend/app/modules/transcripts`

- file/base64 transcription
- language detection
- supported languages endpoint
- websocket live transcription route

### Conferences and Meetings (Daily.co)

- conference host/audience token generation
- conference room lifecycle integration utilizing Daily.co REST API
- meeting generation/start/end endpoints in meetings module

---

## 9. Workers and Background Processing

Workers directory:
- `backend/app/workers/lifecycle.py` active
- placeholder tasks in `backend/app/workers/tasks`:
  - `embeddings.py`
  - `recommendations.py`
  - `transcripts.py`

Lifecycle worker handles scheduled event transitions.

---

## 10. Database and Indexes (Observed)

Indexes are created in `backend/app/db/indexes.py` for:
- users, organizations, events, participants, stands, resources
- meetings, leads, lead_interactions
- chat_rooms, chat_messages
- notifications, subscriptions
- assistant sessions/messages
- analytics_events
- content_flags
- event_sessions
- event_payments
- enterprise products/product_requests
- stand marketplace collections (`stand_products`, `stand_orders`)
- conferences, conference_registrations, conference_qa

Collections referenced by code include all of the above plus:
- audit logs and incident collections from respective modules

---

## 11. Scripts and Test Assets

Current backend scripts folder contains:
- `backend/scripts/seed_platform_test_data.py`

Current `backend/tests` directory:
- no Python test files detected in workspace root tests folder

---

## 12. Known Alignment Notes

- Subscriptions module exists but router is not currently mounted.
- Frontend route tree includes many admin and enterprise pages beyond older docs.
- Marketplace frontend has success/cancel pages but no marketplace index page file currently.
- Some frontend hooks/services/types remain placeholders or empty while backend endpoints exist.

---

## 13. Directory Snapshot (Condensed)

```
backend/
  app/
    main.py
    core/
    db/
    modules/
      admin, ai_rag, ai_translation, analytics, audit, auth, chat,
      conferences, dev, enterprise, events, favorites, incidents, leads,
      marketplace, meetings, monitoring, notifications, organizations,
      organizer_report, participants, payments, recommendations, resources,
      sessions, stands, subscriptions, transcripts, users
    workers/
  scripts/
    seed_platform_test_data.py
  uploads/

frontend/
  src/
    app/
      (admin)/admin/*
      (organizer)/organizer/*
      (enterprise)/enterprise/*
      auth/*
      events/*
      meetings/*
      marketplace/success, marketplace/cancel
    components/
    context/
    hooks/
    lib/
    services/
    types/
```

---

This document reflects the workspace state verified from source files on 2026-03-23, including the final production deployment configuration.
