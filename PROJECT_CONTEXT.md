# PROJECT_CONTEXT.md - Intelligent Virtual Exhibition Platform (IVEP)

Generated: 2026-04-11  
Updated: 2026-04-11  
Purpose: Complete, code-verified project context and architecture reference.

---

## 1) Executive Summary

IVEP is a multi-role virtual exhibition platform that combines event management, enterprise stands, audience interaction, analytics, and AI-powered capabilities.

### Primary User Roles
- **Admin** — Platform governance, user/organization management, finance, audit, monitoring
- **Organizer** — Event creation, lifecycle management, participant approval, analytics
- **Enterprise** — Virtual stands, product catalog, lead tracking, conferences, marketplace
- **Visitor** — Event discovery, ticketing, stand browsing, meetings, AI assistant

### Core Capability Areas
- Event lifecycle and approval workflows
- Paid/free participation flows
- Virtual stands and product marketplace
- Real-time communication (chat, meetings, conferences via Daily.co)
- AI assistant (RAG), translation, and transcription
- Governance and operations (audit, incidents, monitoring, finance)

---

## 2) Workspace Structure (Top-Level)

```
Intelligent-Virtual-Exhibition-Platform/
├── backend/                  # FastAPI backend application
│   ├── app/                  # Application package
│   │   ├── core/             # Config, security, dependencies, middleware
│   │   ├── db/               # MongoDB connection, indexes, utilities
│   │   ├── modules/          # 30+ domain modules (auth, events, stands, etc.)
│   │   ├── workers/          # Background lifecycle workers
│   │   └── main.py           # FastAPI app entry point
│   ├── data/chroma_db/       # Local vector DB storage (RAG)
│   ├── uploads/              # File uploads (enterprise profile, payments, products)
│   ├── scripts/              # Utility scripts (test data seeding)
│   ├── tests/                # Backend unit/integration tests
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile            # Backend container image
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/              # App Router (public + role-based route groups)
│   │   ├── components/       # React component library
│   │   ├── context/          # React context providers (AuthContext)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities (API client, config, media, websocket)
│   │   ├── services/         # API service layer abstractions
│   │   └── types/            # TypeScript type definitions
│   ├── public/               # Static assets
│   ├── package.json          # Node dependencies
│   └── next.config.ts        # Next.js configuration
├── tests/                    # Playwright E2E test suite
│   ├── admin/                # Admin portal tests
│   ├── organisateur/         # Organizer portal tests
│   ├── exposant/             # Enterprise portal tests
│   ├── visiteur/             # Visitor portal tests
│   ├── auth/                 # Authentication flow tests
│   ├── flows/                # Multi-role E2E business process tests
│   ├── fixtures/             # Test data and user fixtures
│   └── helpers/              # Test utilities
├── deploy/                   # Deployment configuration
│   └── nginx/                # Nginx reverse proxy config
├── docs/                     # API specs, documentation
├── package.json              # Root workspace scripts (concurrently, Playwright)
├── docker-compose.yml        # Docker orchestration (backend, Redis, Nginx)
└── playwright.config.ts      # Playwright E2E configuration
```

---

## 3) Technology Stack

### Backend
| Component | Technology |
|-----------|-----------|
| Framework | FastAPI 0.109.0 + Uvicorn 0.27.0 |
| Language | Python 3.11 |
| Database | MongoDB Atlas (M10 Dedicated Cluster) via motor 3.3.2 (async) |
| Caching / Rate Limiting | Redis 7 |
| Authentication | JWT (python-jose), bcrypt, argon2-cffi |
| Payments | Stripe 7.x (event tickets, stand fees, marketplace checkout) |
| Video/Conferencing | Daily.co (via httpx REST API) |
| Object Storage | Cloudflare R2 (boto3 S3-compatible) |
| Vector DB | ChromaDB 0.5.23 (local embeddings for RAG) |
| AI/ML | sentence-transformers, openai-whisper, langchain-text-splitters, transformers, accelerate |
| Report Generation | reportlab, xhtml2pdf, jinja2 |
| Background Workers | asyncio lifecycle tasks (auto event/session transitions) |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16.1.6 (App Router) with React 19.2.3 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + Radix UI + shadcn components |
| State Management | @tanstack/react-query 5 |
| 3D Rendering | Three.js + @react-three/fiber + @react-three/drei |
| Animations | framer-motion |
| Charts | recharts 3 |
| Real-Time | Socket.IO client 4.8.3, Daily.co JS SDK |
| PDF Export | jsPDF + jspdf-autotable |
| HTTP Client | Native fetch with custom wrapper (`src/lib/http.ts`) |

### Testing & DevOps
| Component | Technology |
|-----------|-----------|
| E2E Testing | Playwright 1.54.2 (Chromium, Firefox, WebKit, Mobile) |
| Containerization | Docker (backend), Docker Compose (backend + Redis + Nginx) |
| Reverse Proxy | Nginx 1.27 with Certbot SSL |
| Process Manager | PM2 (production VPS deployment) |
| Frontend Hosting | Vercel Edge Network |
| Backend Hosting | Hetzner Cloud VPS (Ubuntu) |

---

## 4) Architecture

### Backend Architecture Pattern

The backend follows a **modular domain-driven architecture** built on FastAPI:

```
backend/app/
├── main.py                    # Application factory, lifespan, router registration
├── core/                      # Cross-cutting concerns
│   ├── config.py              # Pydantic Settings (env vars, validation)
│   ├── security.py            # JWT verification, token type checking
│   ├── dependencies.py        # FastAPI DI (auth guards, role checks)
│   ├── ratelimit.py           # Rate limiting middleware
│   ├── storage.py             # Cloudflare R2 (boto3) integration
│   ├── fileupload.py          # File upload utilities
│   ├── logging.py             # Logging configuration
│   ├── stripe_webhook.py      # Stripe webhook verification
│   └── timezone.py            # Timezone utilities
├── db/                        # Data layer
│   ├── mongo.py               # Async MongoDB client with retry logic
│   ├── indexes.py             # MongoDB index management
│   └── utils.py               # DB utilities (ObjectId handling)
├── modules/                   # 30+ domain modules
│   └── <module>/
│       ├── router.py          # FastAPI APIRouter (endpoints)
│       ├── service.py         # Business logic
│       ├── schemas.py         # Pydantic models (request/response)
│       └── models.py          # MongoDB document schemas (when used)
└── workers/                   # Background task workers
    ├── lifecycle.py           # Event/session auto-transition worker
    └── tasks/                 # Scheduled task implementations
```

### Application Lifecycle

**Startup Sequence:**
1. Configure logging
2. Connect to MongoDB (with retry logic, 3 attempts, exponential backoff)
3. Ensure database indexes
4. Start background lifecycle task (`lifecycle_loop()`) — runs every 60s

**Background Lifecycle Worker:**
- **Event transitions:** Auto-starts events when `start_date <= now` (from `payment_done` or `approved+free` → `live`), auto-closes when `end_date < now` (`live` → `closed`)
- **Session transitions:** Auto-starts conference sessions (`scheduled` → `live`), auto-ends sessions (`live` → `ended`)
- All transitions are logged to the audit trail

**Shutdown Sequence:**
1. Cancel background lifecycle task
2. Close MongoDB connection

**Middleware Stack (outermost to innermost):**
1. `RateLimitMiddleware` — Request rate limiting via Redis
2. `CORSMiddleware` — CORS policy (allowlist with localhost variants in dev)

### Router Registration

All routers are mounted under `/api/v1` prefix:

**Primary routers (30 module routers):**
- `auth`, `users`, `organizations`, `events`, `participants`, `stands`, `analytics`, `notifications`, `favorites`
- `admin`, `audit`, `incidents`, `payments`, `marketplace`, `finance`, `monitoring`, `sessions`, `organizer_report`, `enterprise`, `conferences`

**Legacy/extra routers with explicit sub-prefixes:**
- `/chat`, `/assistant` (ai_rag), `/translation` (ai_translation), `/transcripts`, `/meetings`, `/resources`, `/leads`, `/recommendations`

**Conditional routers:**
- `dev` router — only when `ENV == "dev"` or `DEBUG` is enabled (data seeding endpoints)

**Disabled routers:**
- `subscriptions` module — router exists but is commented out in `main.py` and not active

### Frontend Architecture Pattern

```
frontend/src/
├── app/                           # Next.js App Router
│   ├── (admin)/                   # Route group: /admin/*
│   ├── (enterprise)/              # Route group: /enterprise/*
│   ├── (organizer)/               # Route group: /organizer/*
│   ├── auth/                      # Public auth routes
│   ├── events/                    # Public event browsing
│   ├── marketplace/               # Stand marketplace
│   ├── meetings/                  # Meeting rooms
│   ├── favorites/                 # User favorites
│   ├── profile/                   # User profile
│   ├── assistant/                 # AI assistant
│   ├── webinars/                  # Webinar listing
│   ├── join/                      # Event join flows (enterprise/visitor)
│   ├── dashboard/                 # User dashboard (orders, etc.)
│   └── diag/                      # Diagnostic page
├── components/                    # React component library
│   ├── ui/                        # shadcn/Radix base components
│   ├── auth/                      # Auth forms
│   ├── dashboard/                 # Dashboard widgets
│   ├── event/                     # Event-related components
│   ├── events/                    # Event listing components
│   ├── stand/                     # Stand components
│   ├── conferences/               # Conference components
│   ├── meetings/                  # Meeting components
│   ├── assistant/                 # AI assistant components
│   ├── hall3d/                    # 3D exhibition hall (Three.js)
│   ├── cards/                     # Card components
│   ├── common/                    # Shared utilities
│   ├── layout/                    # Layout components
│   ├── modals/                    # Modal dialogs
│   └── webinars/                  # Webinar components
├── context/                       # React context
│   └── AuthContext.tsx            # Global auth state provider
├── hooks/                         # Custom React hooks
│   ├── useAuth.ts                 # Auth state hook
│   ├── useEvents.ts               # Event data hook
│   ├── useChat.ts                 # Chat hook (placeholder)
│   ├── useChatWebSocket.ts        # WebSocket chat hook
│   ├── useNotifications.ts        # Notifications hook (placeholder)
│   ├── useStands.ts               # Stand data hook (placeholder)
│   └── useDailyRoom.ts            # Daily.co video room hook
├── services/                      # API service layer
│   ├── auth.service.ts            # Authentication API calls
│   ├── events.service.ts          # Events API calls
│   ├── admin.service.ts           # Admin API calls
│   ├── organizer.service.ts       # Organizer API calls
│   ├── favorites.service.ts       # Favorites API calls
│   ├── assistant.service.ts       # AI assistant API calls
│   ├── chat.service.ts            # Chat API calls (placeholder)
│   └── stands.service.ts          # Stands API calls (placeholder)
├── types/                         # TypeScript definitions
│   ├── user.ts, event.ts, stand.ts, organization.ts
│   ├── admin.ts, analytics.ts, audit.ts, finance.ts
│   ├── marketplace.ts, meeting.ts, conference.ts
│   ├── monitoring.ts, incident.ts, participant.ts
│   ├── sessions.ts, organizer.ts, chat.ts
└── lib/                           # Utilities
    ├── http.ts                    # HTTP client (fetch wrapper with auth, blob downloads)
    ├── api/                       # API client layer
    │   ├── client.ts              # API client configuration
    │   └── endpoints.ts           # Endpoint definitions
    ├── config.ts                  # Environment config (API URLs, R2 base URL)
    ├── auth.ts                    # Auth utilities
    ├── media.ts                   # Media/URL resolution
    ├── websocket.ts               # WebSocket utilities
    ├── timezone.ts                # Timezone conversions
    ├── schedule.ts                # Schedule helpers
    ├── eventLifecycle.ts          # Event state helpers
    ├── eventWorkflowBadge.ts      # Workflow badge component
    ├── utils.ts                   # General utilities
    └── pdf/                       # PDF generation helpers
```

---

## 5) Complete Route Tree

### Public/Common Routes (23 pages)
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/auth/login` | Login page |
| `/auth/register` | Registration page |
| `/events` | Event listing |
| `/events/[id]` | Event detail |
| `/events/[id]/payment` | Event ticket payment |
| `/events/[id]/live` | Live event view |
| `/events/[id]/live/stands/[standId]` | Live stand view |
| `/events/[id]/live/conferences/[confId]/watch` | Live conference watch |
| `/events/[id]/stands/[standId]` | Stand detail |
| `/favorites` | User favorites |
| `/profile` | User profile |
| `/marketplace` | Marketplace landing |
| `/marketplace/success` | Marketplace checkout success |
| `/marketplace/cancel` | Marketplace checkout cancel |
| `/meetings/[meetingId]/room` | Meeting room |
| `/webinars` | Webinar listing |
| `/assistant` | AI assistant |
| `/join/enterprise/[eventId]` | Enterprise event join flow |
| `/join/visitor/[eventId]` | Visitor event join flow |
| `/dashboard` | User dashboard |
| `/dashboard/orders` | Order history |
| `/diag` | Diagnostic page |

### Admin Routes (20 pages) — `/admin/*`
| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard |
| `/admin/users` | User management |
| `/admin/enterprises` | Enterprise management |
| `/admin/organizations` | Organization management |
| `/admin/events` | Event listing (all) |
| `/admin/events/[id]` | Event detail (admin view) |
| `/admin/events/[id]/sessions` | Event conference sessions |
| `/admin/events/[id]/enterprises` | Event enterprises |
| `/admin/events/[id]/monitoring` | Event live-monitoring |
| `/admin/events/[id]/organizer-report` | Organizer BI report |
| `/admin/event-join-requests` | Enterprise/visitor join requests |
| `/admin/organizer-registrations` | Organizer approval queue |
| `/admin/finance` | Financial transactions & payouts |
| `/admin/payments` | Payment listing |
| `/admin/subscriptions` | Subscription plans |
| `/admin/monitoring` | Platform monitoring |
| `/admin/analytics` | Platform analytics |
| `/admin/analytics/[id]` | Per-event analytics |
| `/admin/audit` | Audit log viewer |
| `/admin/incidents` | Incident management |

### Enterprise Routes (18 pages) — `/enterprise/*`
| Route | Description |
|-------|-------------|
| `/enterprise` | Enterprise dashboard |
| `/enterprise/events` | Available events |
| `/enterprise/events/payment-success` | Payment success |
| `/enterprise/events/[eventId]/manage` | Event participation management |
| `/enterprise/events/[eventId]/manage/requests` | Participation requests |
| `/enterprise/events/[eventId]/stand` | Stand management |
| `/enterprise/events/[eventId]/conferences` | Conference listing |
| `/enterprise/events/[eventId]/conferences/[confId]/live` | Live conference broadcast |
| `/enterprise/events/[eventId]/analytics` | Stand analytics |
| `/enterprise/conferences` | My conferences |
| `/enterprise/analytics` | Cross-event analytics |
| `/enterprise/leads` | Lead management |
| `/enterprise/products` | Product catalog |
| `/enterprise/product-requests` | Product request management |
| `/enterprise/communications` | Communications hub |
| `/enterprise/notifications` | Notification center |
| `/enterprise/profile` | Enterprise profile |

### Organizer Routes (8 pages) — `/organizer/*`
| Route | Description |
|-------|-------------|
| `/organizer` | Organizer dashboard |
| `/organizer/events` | Event listing |
| `/organizer/events/new` | Create event |
| `/organizer/events/[id]` | Event detail |
| `/organizer/events/[id]/analytics` | Event analytics |
| `/organizer/notifications` | Notification center |
| `/organizer/profile` | Organizer profile |
| `/organizer/subscription` | Subscription management |

---

## 6) Backend Module Inventory & Endpoints

| Module | Prefix | Key Functionality |
|--------|--------|-------------------|
| **auth** | `/auth` | Login, register, token refresh, RBAC test routes |
| **users** | `/users` | Profile management, admin user administration |
| **organizations** | `/organizations` | Org CRUD, member invites, admin moderation |
| **events** | `/events` | Event lifecycle, admin review, payment, invites, AI title suggestion |
| **participants** | `/participants/event/{event_id}` | Invitations, join requests, approvals, stand fee payment |
| **stands** | `/events/{event_id}/stands` | Stand CRUD, listing with filtering, branding enrichment |
| **analytics** | `/metrics` | Event logging, dashboards, PDF/CSV/Tex exports, live metrics |
| **notifications** | `/notifications` | Notification listing, mark as read |
| **favorites** | `/favorites` | Bookmark stands/events/resources |
| **admin** | `/admin` | Platform control, health, registration approval, dashboards, force start/close |
| **audit** | `/audit` | Audit trail viewing with filtering |
| **incidents** | `/incidents` | Incident tracking, content flagging |
| **payments** | `/payments` | Event ticket checkout, Stripe webhook, receipts |
| **marketplace** | `/marketplace` | Product/service catalog, Stripe checkout, cart, orders, receipts |
| **finance** | `/admin/finance` | Financial transactions, payout management |
| **monitoring** | `/admin` | Live operational metrics, WebSocket push (5s intervals) |
| **sessions** | `/events/{event_id}/sessions` | Conference session lifecycle (scheduled → live → ended) |
| **organizer_report** | *(various)* | BI reports, PDF exports for events and overall |
| **enterprise** | `/enterprise` | Profile, products, event join, stand management, payment proof upload |
| **conferences** | `/conferences` | Conference scheduling, Daily.co broadcasting, Q&A |
| **chat** | `/chat` | Real-time messaging (visitor-stand, B2B), WebSocket |
| **ai_rag** | `/assistant` | AI assistant with RAG, vector search, document ingestion (SSE streaming) |
| **ai_translation** | `/translation` | Text translation, language detection |
| **transcripts** | `/transcripts` | Whisper audio transcription, live WebSocket streaming |
| **meetings** | `/meetings` | B2B meeting scheduling, conflict detection, Daily.co tokens |
| **resources** | `/resources` | Stand resource uploads, catalog, download tracking |
| **leads** | `/leads` | Lead tracking, interaction logging, CSV export |
| **recommendations** | `/recommendations` | ML-powered personalized recommendations (content-based + collaborative filtering) |
| **subscriptions** | `/subscriptions` | Subscription plan assignment (module present, router disabled) |
| **dev** | `/dev` | Database seeding (dev env only) |

---

## 7) Data Flow

### Authentication Flow
1. User submits credentials → `POST /auth/login`
2. Backend validates, issues JWT access + refresh tokens
3. Tokens stored in `localStorage` as `auth_tokens`
4. Frontend `http.ts` wrapper auto-attaches `Authorization: Bearer <token>`
5. On 401, redirect to `/auth/login`
6. Role-based access enforced via FastAPI `require_role()` / `require_roles()` dependencies

### Event Lifecycle Flow
1. Organizer creates event → `POST /events` → state: `pending`
2. Admin reviews → `POST /events/{id}/approve` (sets price) → state: `approved`
3. Organizer pays → `POST /events/{id}/submit-proof` → Admin confirms → state: `payment_done`
   - OR: Free event auto-transitions `approved` → `live`
4. Background worker auto-starts when `start_date <= now` → state: `live`
5. Background worker auto-closes when `end_date < now` → state: `closed`
6. Admin can force transitions: `POST /admin/events/{id}/force-start` or `force-close`

### Enterprise Participation Flow
1. Enterprise browses events → `GET /enterprise/events`
2. Requests to join → `POST /enterprise/events/{id}/join` → pending approval
3. Admin approves/rejects → `POST /admin/enterprise-registrations/{id}/approve|reject`
4. Enterprise pays stand fee → Stripe checkout or upload payment proof
5. Stand auto-created → `GET /enterprise/events/{id}/stand`
6. Enterprise manages stand: uploads images, adds products/resources

### Payment Flow (Stripe)
1. **Event Ticket:** `POST /payments/events/{id}/checkout` → Stripe session → redirect → webhook → `POST /payments/webhook` → verify → grant access
2. **Stand Fee:** Enterprise initiates → `POST /participants/event/{id}/stands/payment/initiate` → Stripe checkout → webhook handles
3. **Marketplace:** `POST /marketplace/stands/{id}/products/{id}/checkout` or cart checkout → Stripe session → webhook → order creation
4. Global webhook: `POST /api/v1/payments/webhook` handles all Stripe events (event tickets, stand fees, marketplace)

### AI RAG Flow
1. Document ingestion → `POST /{scope}/ingest` → split text → embed → store in ChromaDB
2. Query → `POST /{scope}/query` → retrieve similar docs → augment prompt → stream AI response (SSE)
3. Scope determines knowledge base context (event-specific, platform-wide, etc.)

---

## 8) External Services & Integrations

### MongoDB Atlas
- **Cluster:** M10 Dedicated
- **Driver:** motor (async)
- **Connection:** `MONGO_URI` env var (supports `mongodb://` and `mongodb+srv://`)
- **Features:** Retry logic (3 attempts, exponential backoff), connection pooling (50 max, 10 min), health checks
- **Indexes:** Auto-created on startup via `ensure_indexes()`

### Stripe
- **Version:** 7.x
- **Keys:** Test keys (development), production keys in deployment
- **Webhook:** Global endpoint at `/api/v1/payments/webhook` and `/api/v1/marketplace/webhook/stripe`
- **Events Handled:** `checkout.session.completed` for event tickets, stand fees, marketplace orders

### Daily.co
- **Integration:** REST API via httpx (replaced LiveKit)
- **Features:** Room creation, access tokens, meeting management
- **Config:** `DAILY_API_KEY`, `DAILY_DOMAIN` env vars
- **Usage:** Conferences (broadcast), meetings (1-on-1)

### Cloudflare R2
- **Integration:** boto3 (S3-compatible API)
- **Config:** `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_PUBLIC_BASE_URL`
- **Usage:** Enterprise logos/banners, product images, resource files, event banners
- **Priority:** R2 URLs preferred over local `uploads/` directory in production

### ChromaDB
- **Location:** `backend/data/chroma_db/`
- **Purpose:** Local vector store for AI RAG assistant
- **Features:** Document ingestion, similarity search, scope-based knowledge bases

### Redis
- **Purpose:** Rate limiting middleware
- **Docker:** Redis 7 Alpine with append-only persistence
- **Connection:** Configured via `docker-compose.yml`

---

## 9) Environment Configuration

### Backend Environment Variables (`.env`)
```bash
# App
APP_NAME=Intelligent Virtual Exhibition Platform
ENV=dev|prod|production
DEBUG=true|false
API_V1_STR=/api/v1
CORS_ORIGINS=["http://localhost:3000","https://yourdomain.com"]

# Security
JWT_SECRET_KEY=<strong-random-key>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/ivep_db
DATABASE_NAME=ivep_db

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=https://yourdomain.com

# Daily.co
DAILY_API_KEY=<api-key>
DAILY_DOMAIN=yourapp.daily.co

# Cloudflare R2
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret-key>
R2_BUCKET_NAME=ivep-uploads
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=https://cdn.yourdomain.com
```

### Frontend Environment Variables (`.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_IVEP_SAFE_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_R2_PUBLIC_BASE_URL=https://cdn.yourdomain.com
NEXT_PUBLIC_BROWSER_API_PROXY=1
NEXT_PUBLIC_API_PROXY_IPV4=1
```

---

## 10) Production Deployment Architecture

### Frontend (Vercel)
- Deployed on Vercel Edge Network
- Root directory: `frontend/`
- Environment variables configured in Vercel dashboard
- `NEXT_PUBLIC_API_URL` points to production backend
- Automatic HTTPS

### Backend (Hetzner VPS)
- **OS:** Ubuntu
- **Runtime:** Python 3.11 in `venv`
- **Process Manager:** PM2 (`pm2 start uvicorn`)
- **Reverse Proxy:** Nginx with Certbot SSL
- **Exposed:** HTTPS only, CORS configured for frontend domain

### Docker Compose (Alternative Deployment)
```yaml
Services:
- backend: FastAPI on port 8000 (internal)
- redis: Redis 7 (rate limiting)
- nginx: Reverse proxy (ports 80, 443)
Volumes:
- backend_uploads: Persisted uploads
- redis_data: Redis persistence
- letsencrypt: SSL certificates
- certbot_webroot: Certbot challenge
```

---

## 11) Development Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env  # configure environment variables
uvicorn app.main:app --reload
# Available at http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # configure environment variables
npm run dev
# Available at http://localhost:3000
```

### Full Stack (from root)
```bash
npm run dev  # Runs backend on :8000 and frontend on :3000 via concurrently
```

### Testing
```bash
# E2E Tests (Playwright)
npm run test                  # All tests
npm run test:admin            # Admin tests
npm run test:organizer        # Organizer tests
npm run test:exhibitor        # Enterprise tests
npm run test:visitor          # Visitor tests
npm run test:flows            # Multi-role flow tests
npm run test:headed           # Run with browser visible
npm run test:ui               # Playwright UI mode

# Backend Tests
cd backend && pytest
```

---

## 12) Important Constraints & Design Decisions

### Security
- JWT tokens expire in 30 minutes (access), 7 days (refresh)
- Production requires strong `JWT_SECRET_KEY`, `DEBUG=false`, MongoDB Atlas (not localhost)
- CORS origins validated in production
- Rate limiting via Redis middleware
- File uploads validated and stored on R2 (preferred) or local
- Stripe webhook signature verification

### Performance
- MongoDB connection pooling: 50 max, 10 min
- Background lifecycle worker: 60s interval
- Monitoring WebSocket: 5s push interval
- ChromaDB: local (not distributed) — suitable for dev/small production

### Limitations
- **Subscriptions module:** Router disabled; subscription features not active
- **Frontend placeholders:** `chat.service.ts`, `stands.service.ts`, `useChat.ts`, `useNotifications.ts`, `useStands.ts` are empty/stubs
- **Marketplace index page:** `/marketplace` is a placeholder landing page
- **R2 media sync:** Some legacy assets may still reside in `backend/uploads/` instead of R2
- **Recommendations module:** Conditionally disabled if ML dependencies fail to import
- **AI modules:** `ai_rag`, `ai_translation`, `transcripts` are gracefully disabled if optional dependencies (sentence-transformers, whisper) fail to import

### Architecture Decisions
- **Video provider:** Daily.co replaced LiveKit (simpler integration, cloud-hosted)
- **Database:** MongoDB chosen over PostgreSQL for flexible schema (event/stand/product heterogeneity)
- **Vector DB:** ChromaDB (local) instead of Pinecone/Weaviate (cost simplicity)
- **Frontend:** Next.js App Router with route groups for role isolation
- **HTTP Client:** Native `fetch` with custom wrapper (not axios) — lighter bundle
- **File Storage:** R2 preferred for production; local `uploads/` for dev fallback
- **Testing:** Playwright over Cypress (multi-browser, better API testing)

---

## 13) Change Log

### 2026-04-11 - Comprehensive Codebase Analysis
- Full analysis of all 30 backend modules with endpoint documentation
- Complete frontend route tree mapped (68 page.tsx files)
- Verified technology versions from `requirements.txt` and `package.json`
- Documented background lifecycle workers (event/session auto-transitions)
- Merged insights from previous context file while correcting and expanding coverage

### 2026-04-05 - Finance & Marketplace Integration
- Comprehensive finance module: transaction tracking, payout management
- Marketplace: stand product/service CRUD, Stripe checkout, cart management, unified order tracking
- Enterprise/visitor join request flows with token validation
- Enhanced admin finance dashboard

### 2026-03-23 - Platform Audit & R2 Media Verification
- Comprehensive audit of all user roles (GET and POST/PATCH flows)
- Fixed `resolveMediaUrl` and upload logic to prioritize Cloudflare R2
- Implemented protocol enforcement to resolve Mixed Content errors
- Verified GET/POST/PATCH flows for profiles, event creation, and admin approval

---

## 14) Reference Files

- `README.md` — Project overview and quickstart
- `backend/app/main.py` — Backend application factory
- `backend/app/core/config.py` — Environment configuration and validation
- `backend/app/core/dependencies.py` — Auth/role dependency guards
- `frontend/src/lib/http.ts` — Frontend HTTP client
- `frontend/src/lib/config.ts` — Frontend environment configuration
- `docker-compose.yml` — Docker orchestration
- `playwright.config.ts` — E2E test configuration
- `package.json` (root) — Development scripts

---

This document reflects the workspace state as of 2026-04-11, verified from source files across all modules, services, and configuration.