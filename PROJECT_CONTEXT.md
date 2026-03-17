# PROJECT_CONTEXT.md - Intelligent Virtual Exhibition Platform (IVEP)

Generated: 2026-03-15
Purpose: Updated code-verified project context snapshot.

---

## 1. Project Overview

IVEP is an AI-enabled virtual exhibition platform with role-based portals (admin, organizer, enterprise, visitor) supporting:

- Event lifecycle management with admin approval and payment gates
- Virtual stands, resources, chat, meetings, and conference streaming
- AI assistant (RAG), translation, transcription, and recommendations
- Governance features: audit logs, incidents, platform monitoring
- Marketplace and event payment capabilities via Stripe

---

## 2. Tech Stack

### Backend

- Python 3.10+
- FastAPI
- MongoDB (Motor async client)
- Redis
- JWT auth (`python-jose`) and password hashing (`argon2-cffi`)
- Stripe
- LiveKit API integration
- ChromaDB + sentence-transformers + Ollama (RAG/embeddings)
- Whisper (transcription)
- Transformers + MarianMT components (translation path)

### Frontend

- Next.js 16.1.6 (App Router)
- React 19.2.3 + TypeScript 5
- Tailwind CSS 4 + shadcn
- TanStack Query v5
- LiveKit React components + livekit-client
- Three.js (`three`, `@react-three/fiber`, `@react-three/drei`)
- Recharts

---

## 3. Backend Architecture

### 3.1 Core App

Main file: `backend/app/main.py`

Startup lifecycle:
- Setup logging
- Connect to MongoDB
- Ensure indexes
- Start `lifecycle_loop()` background worker

Shutdown lifecycle:
- Cancel lifecycle worker
- Close MongoDB connection

CORS allowlist includes localhost and LAN dev origins on ports 3000/3001.

Static files:
- `/uploads` mounted from `backend/uploads`

Root endpoints:
- `GET /` -> welcome message
- `GET /health` -> health status

### 3.2 Router Registration (Actual Current State)

Registered under `API_V1_STR` (default `/api/v1`):

- `/auth` auth router
- `/users` users router
- `/organizations` organizations router
- `/events` events router
- `/participants/event/{event_id}` participants router
- `/events/{event_id}/stands` stands router
- `/analytics` analytics router
- `/notifications` notifications router
- `/favorites` favorites router
- `/admin` admin router
- `/audit` audit router
- `/incidents` incidents router
- payments router (paths include `/events/{event_id}/checkout`, `/admin/event-payments`)
- `/marketplace` marketplace router
- `/admin/events/{event_id}/live-metrics` monitoring router
- sessions router (`/admin/events/{event_id}/sessions`, `/events/{event_id}/sessions`)
- organizer-report router (mixed `/admin/...` and `/organizer/...` paths)
- `/enterprise` enterprise router
- conferences router (mixed organizer, enterprise, and public conference paths)

Legacy/extra mounted with explicit prefixes:
- `/chat`
- `/assistant`
- `/translation`
- `/transcripts`
- `/meetings`
- `/resources`
- `/leads`
- `/recommendations`

Dev router:
- `/dev` is mounted only in `dev` or `DEBUG=true`

Important note:
- Subscriptions router exists but is currently not mounted in `main.py` (disabled include).

### 3.3 Auth, Roles, Dependencies

Role enum (`auth/enums.py`):
- `admin`, `organizer`, `enterprise`, `visitor`

Auth dependency behavior (`core/dependencies.py`):
- Bearer token auth via `HTTPBearer`
- Access token verification with legacy decode fallback
- `test-token` bypass returns synthetic visitor in dev path
- RBAC helpers: `require_role`, `require_roles`
- Subscription feature gate helper exists (`require_feature`) and still references subscription plan features

---

## 4. Backend Modules (Current)

Current module routers in `backend/app/modules/*/router.py`:

- `admin`
- `ai_rag`
- `ai_translation`
- `analytics`
- `audit`
- `auth`
- `chat`
- `conferences`
- `dev`
- `enterprise`
- `events`
- `favorites`
- `incidents`
- `leads`
- `marketplace`
- `meetings`
- `monitoring`
- `notifications`
- `organizations`
- `organizer_report`
- `participants`
- `payments`
- `recommendations`
- `resources`
- `sessions`
- `stands`
- `subscriptions` (present but not mounted)
- `transcripts`
- `users`

---

## 5. Key Domain States and Enums

### Event states (`events/schemas.py`)

- `pending_approval`
- `approved`
- `rejected`
- `waiting_for_payment`
- `payment_proof_submitted`
- `payment_done`
- `live`
- `closed`

Legacy `draft` is coerced to `pending_approval`.

### Participant statuses (`participants/schemas.py`)

- `invited`
- `requested`
- `approved`
- `rejected`
- `pending_payment`
- `pending_admin_approval`

### Notification types (`notifications/schemas.py`)

Includes event/payment lifecycle and conference/meeting notifications, notably:
- `conference_assigned`, `conference_live`
- `meeting_approved`, `meeting_rejected`
- `payment_proof_submitted`, `visitor_payment_approved`, `visitor_payment_rejected`

### Conference status (`conferences/schemas.py`)

- `scheduled`, `live`, `ended`, `canceled`

### Analytics event types (`analytics/schemas.py`)

- `event_view`, `stand_visit`, `chat_opened`
- `meeting_booked`, `payment_confirmed`, `conference_joined`

---

## 6. API Surface Summary (Current)

### Auth (`/api/v1/auth`)
- Login/register/refresh
- Role test routes

### Users (`/api/v1/users`)
- `GET/PUT /me`
- Admin user operations under `/users/admin/...` including list, activate, suspend, create

### Events (`/api/v1/events`)
- Public list/detail
- Organizer create/update/delete own events
- Join/status/joined list
- Admin approve/reject
- Payment flow endpoints including `submit-proof`, `confirm-payment`
- Lifecycle transitions `start`, `close`
- Schedule conference assignment endpoint exists

### Participants (`/api/v1/participants/event/{event_id}`)
- invite/request/approve/reject
- list attendees and enterprise participants

### Stands (`/api/v1/events/{event_id}/stands`)
- create/list/detail/update

### Organizations (`/api/v1/organizations`)
- create/invite/list/get
- admin moderation: verify/flag/suspend organization

### Notifications (`/api/v1/notifications`)
- list, mark single read, mark all read

### Analytics (`/api/v1/analytics`)
- event logging and dashboards
- report export and role-specific report endpoints
- live analytics endpoints for platform/event/stand

### Governance

Admin (`/api/v1/admin`):
- health
- enterprise request workflows
- force lifecycle transitions
- organizer/enterprise registration approvals and rejections
- detailed organization and enterprise dashboards

Audit (`/api/v1/audit`):
- list logs + list actions

Incidents (`/api/v1/incidents`):
- create/list/update incidents
- content flag create/list

Monitoring (`/api/v1/admin/events/{event_id}/...`):
- REST live metrics
- WebSocket monitoring feed

### Enterprise (`/api/v1/enterprise`)
- profile read/update/logo/banner upload
- product CRUD and product image management
- incoming product requests + status updates
- public product request endpoint for visitors
- enterprise event join/pay flow
- stand management and assistant enable/status

### Marketplace (`/api/v1/marketplace`)
- stand products and checkout flows
- Stripe webhook path
- stand orders and user order queries

### Payments (visitor ticket payments)
- `POST /events/{event_id}/checkout`
- `POST /events/{event_id}/verify-payment`
- `GET /events/{event_id}/my-payment-status`
- `GET /events/{event_id}/my-receipt`
- `GET /admin/event-payments`

### Conferences (video and Q&A)

Organizer:
- create/list/update/cancel event conferences

Enterprise host:
- list assigned conferences
- start/end conference
- get speaker token

Audience/public:
- list/get conference
- register/unregister
- get audience token
- Q&A create/list/answer/upvote

### Sessions

Admin:
- create/sync/list sessions for event
- start/end session

Authenticated users:
- list event sessions

### Additional modules
- chat (rooms/messages/ws)
- meetings (book/list/status + token/start/end)
- resources (upload/list/track)
- leads (list/interactions/export)
- recommendations (event/user/enterprise/similar + interaction logging)
- assistant (RAG query/ingest/stats/session)
- translation (translate/detect)
- transcripts (transcribe/file/detect/languages/ws)

---

## 7. Frontend Architecture (Current)

### 7.1 Route Groups and Layouts

Layouts:
- root layout: `src/app/layout.tsx`
- admin layout: `src/app/(admin)/admin/layout.tsx`
- organizer layout: `src/app/(organizer)/organizer/layout.tsx`
- enterprise layout: `src/app/(enterprise)/enterprise/layout.tsx`

Root layout uses:
- `AuthProvider`
- `ClientLayout`
- Inter font

### 7.2 Current Page Inventory (high-level)

Public/common:
- `/`, `/events`, `/events/[id]`, `/events/[id]/live`, stand pages, payment page
- `/auth/login`, `/auth/register`
- `/dashboard`, `/profile`, `/favorites`, `/assistant`, `/webinars`
- meeting room page (`/meetings/[meetingId]/room`)

Admin:
- dashboard, events list/detail, event sessions, event monitoring, event enterprises
- analytics platform + per-event
- users, organizations, subscriptions, payments
- incidents, audit, monitoring
- organizer registrations, event join requests, enterprises listing
- organizer report page

Organizer:
- dashboard, events list/new/detail/analytics
- profile, subscription, notifications

Enterprise:
- dashboard, profile, notifications, communications
- events list + per-event manage/stand/analytics/conferences/live
- products, product requests, leads, analytics, conferences list

Marketplace pages:
- currently `success` and `cancel` pages are present
- no `src/app/marketplace/page.tsx` exists in current tree

### 7.3 Frontend API Layer and Services

HTTP clients:
- `src/lib/http.ts`
- `src/lib/api/client.ts`

API helpers:
- `src/lib/api/endpoints.ts`
- typed API modules: `events.ts`, `notifications.ts`, `organizations.ts`, `organizer.ts`

Services in use:
- `auth.service.ts`
- `events.service.ts`
- `favorites.service.ts`
- `assistant.service.ts`
- `admin.service.ts`
- `organizer.service.ts`

Placeholder/empty service files still present:
- `chat.service.ts`
- `stands.service.ts`

### 7.4 Hooks

Current hooks:
- `useAuth.ts`
- `useChatWebSocket.ts`
- `useChat.ts` (placeholder)
- `useEvents.ts` (placeholder)
- `useNotifications.ts` (placeholder)
- `useStands.ts` (placeholder)

### 7.5 Types

Current `src/types` files include:
- `admin`, `analytics`, `audit`, `chat`, `conference`, `event`, `incident`, `marketplace`
- `meeting`, `monitoring`, `organization`, `organizer`, `participant`, `sessions`, `stand`, `user`

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

### Conferences and Meetings (LiveKit)

- conference host/audience token generation
- conference room lifecycle integration with LiveKit
- meeting token/start/end endpoints in meetings module

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

This document reflects the workspace state verified from source files on 2026-03-15.
