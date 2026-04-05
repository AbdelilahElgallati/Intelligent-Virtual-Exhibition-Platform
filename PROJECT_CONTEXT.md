# PROJECT_CONTEXT.md - Intelligent Virtual Exhibition Platform (IVEP)

Generated: 2026-04-05
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
- Governance and operations (audit, incidents, monitoring, finance)

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
- auth, users, organizations, events, participants, stands, analytics, notifications, favorites
- admin, audit, incidents, payments, marketplace, finance, monitoring, sessions, organizer_report, enterprise, conferences

Mounted legacy/extra routers with explicit sub-prefixes:
- `/chat`, `/assistant`, `/translation`, `/transcripts`, `/meetings`, `/resources`, `/leads`, `/recommendations`

Conditional router:
- `dev` router only when environment is dev or debug is enabled

Important current note:
- subscriptions module router exists in codebase but is commented/disabled in `main.py` and therefore not active in runtime routing.

---

## 6) Backend Modules Inventory

Modules present in `backend/app/modules/`:
- admin, ai_rag, ai_translation, analytics, audit, auth, chat, conferences, dev, daily, enterprise, events, favorites, finance, incidents, leads, marketplace, meetings, monitoring, notifications, organizations, organizer_report, participants, payments, recommendations, resources, sessions, stands, subscriptions, transcripts, users

Router coverage:
- 30 module routers currently exist under `backend/app/modules/**/router.py`
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
- Visitor invitation acceptance with token validation

### Payments and Finance
- Event ticket checkout and verification endpoints in payments module
- Global webhook endpoint (`/webhook`) handling Stripe `checkout.session.completed` events
- **Finance Module**: Comprehensive tracking of financial transactions and payouts.
- Platform-wide payout management for admins (mark, update, delete payouts).

### Enterprise Ecosystem & Marketplace
- Enterprise profile and media management
- Product catalog and product requests
- Enterprise event participation and stand management
- **Marketplace**: Stand-specific product/service CRUD, Stripe checkout, cart management, and unified order tracking.

### Conferences, Meetings, and Real-Time
- Conference create/manage/start/end with role-specific operations
- Meeting booking and meeting room experiences (Daily.co)
- Chat and monitoring websocket-enabled experiences

### AI and Knowledge Features
- AI assistant (RAG query/ingest/stats flows)
- Translation and Transcription endpoints (including websocket-related flows)
- Recommendation endpoints and interaction logging

### Governance and Operations
- Audit logs, action tracking, and incident management
- Live monitoring metrics and presence tracking

---

## 8) Frontend Architecture and Route Coverage

Primary app structure:
- Root app router under `frontend/src/app`
- Role-separated route groups: `(admin)`, `(organizer)`, `(enterprise)`

Public/common routes include:
- landing page, auth (login/register), marketplace
- events list/details/live/payment, favorites, assistant, webinars
- join (enterprise/visitor) with event-specific tokens
- meetings room page, diagnostic (`/diag`)

Admin pages include:
- dashboard, users, organizations, subscriptions, payments
- finance (transactions/payouts), incidents, audit, monitoring
- events list/detail, sessions, monitoring, enterprises, organizer report
- analytics (overview/per-event), organizer registrations, event join requests

Organizer pages include:
- dashboard, event list/new/detail/analytics
- profile, notifications, subscription

Enterprise pages include:
- dashboard, profile, notifications, communications
- events list, manage/stand/analytics/conferences/live pages
- event payment success, products, product requests, leads, analytics

Current route density signal:
- 70+ `page.tsx` files found under `frontend/src/app/**/page.tsx`

---

## 9) Frontend Data/API Layer Snapshot

API client and endpoint layers exist in:
- `frontend/src/lib/http.ts`
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/api/endpoints.ts`

Service layer currently includes (non-exhaustive):
- auth, events, favorites, assistant, admin, organizer, stands (placeholder), chat (placeholder)

Known placeholder service/hook areas still present:
- `chat.service.ts` (0 lines)
- `stands.service.ts` (0 lines)
- `src/types/chat.ts` (empty)
- `useChat.ts`, `useNotifications.ts`, `useStands.ts`

---

## 10) Data, Assets, and Runtime Storage

Persistent and media storage seen in workspace:
- `backend/data/chroma_db/` for local embedding/vector data persistence
- `backend/uploads/` for user and business uploads (enterprise assets, product images, resources, etc.)

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

---

## 12) Known Gaps / Technical Debt (Current)

- **Subscriptions**: Router is present but not mounted in backend application registration.
- **Placeholders**: Several frontend services (`chat`, `stands`) and types are still empty placeholders.
- **Marketplace UI**: The marketplace index page (`/marketplace`) is currently a placeholder landing page.
- **R2 Media Status**: Core assets verified. Some event banners may still require manual sync from legacy `backend/uploads` to R2 bucket.

---

## 13) Change Log (Latest Verified Modifications)

### 2026-04-05 - Finance & Marketplace Integration

Implemented a comprehensive finance and marketplace ecosystem.

- **Finance Module**: Added platform-wide transaction tracking and payout management. Admin can now manage payouts and view financial transactions across events and marketplace.
- **Marketplace**: Fully functional backend for stand products/services, cart checkout, and unified order tracking. Added frontend marketplace routes including success/cancel pages.
- **Participation**: Added specific routes and logic for enterprise and visitor join requests with token validation.
- **Governance**: Enhanced admin finance dashboard and payout workflows.

### 2026-03-23 - Platform Audit & R2 Media Verification

Comprehensive audit of all user roles for both GET and Mutation (POST/PATCH) flows.

- **Storage**: Fixed `resolveMediaUrl` and upload logic to prioritize Cloudflare R2.
- **Security**: Implemented protocol enforcement in `config.ts` to resolve Mixed Content errors.
- **Validation**: Verified GET/POST/PATCH flows for profiles, event creation, and admin approval.

---

## 14) Reference Files for Ongoing Maintenance

Primary reference files:
- `PROJECT_CONTEXT.md` (this document)

---

This document reflects the workspace state verified from source files on 2026-04-05, including the final production deployment configuration.
