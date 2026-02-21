# PROJECT_CONTEXT.md — Intelligent Virtual Exhibition Platform (IVEP)

> **Generated**: 2026-02-21  
> **Purpose**: Comprehensive project context document for development reference.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Backend Architecture](#3-backend-architecture)
   - [Core Configuration](#31-core-configuration)
   - [Security & Auth](#32-security--auth)
   - [Dependency Injection](#33-dependency-injection)
   - [Database Layer](#34-database-layer)
   - [Application Entry Point](#35-application-entry-point)
4. [Roles & Enums](#4-roles--enums)
5. [Backend Modules — Schemas](#5-backend-modules--schemas)
6. [Backend Modules — API Endpoints](#6-backend-modules--api-endpoints)
7. [Frontend Architecture](#7-frontend-architecture)
   - [Dependencies](#71-dependencies)
   - [Pages & Routing](#72-pages--routing)
   - [Auth Context](#73-auth-context)
   - [HTTP Client Layer](#74-http-client-layer)
   - [API Endpoints Map](#75-api-endpoints-map)
   - [TypeScript Types](#76-typescript-types)
   - [Hooks](#77-hooks)
   - [Services](#78-services)
8. [AI & ML Layer](#8-ai--ml-layer)
9. [Workers (Background Tasks)](#9-workers-background-tasks)
10. [Scripts & Tests](#10-scripts--tests)
11. [Database Indexes](#11-database-indexes)
12. [MongoDB Collections](#12-mongodb-collections)
13. [Event Lifecycle State Machine](#13-event-lifecycle-state-machine)
14. [Directory Structure](#14-directory-structure)

---

## 1. Project Overview

The **Intelligent Virtual Exhibition Platform (IVEP)** is a scalable, AI-powered SaaS platform that enables organizers, enterprises, and visitors to participate in immersive online exhibitions. It replicates and enhances physical expos through:

- Virtual exhibition halls with interactive stands
- Real-time chat, meetings, and webinars
- AI-powered recommendations & matchmaking (hybrid content-based + collaborative filtering)
- RAG-based multilingual AI assistant (ChromaDB + Ollama)
- Analytics & lead generation/CRM
- Subscription-based monetization (Free / Pro plans)
- Speech-to-text transcription (Whisper)
- Automated language translation (Helsinki-NLP MarianMT)

---

## 2. Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| Framework | FastAPI (Python 3.10+) |
| Database | MongoDB (async via Motor) |
| Cache | Redis |
| Auth | JWT (python-jose) + Argon2 (passlib) |
| AI/LLM | Ollama (local LLM) |
| Embeddings | multilingual-e5-small via Ollama |
| Vector DB | ChromaDB |
| Translation | Helsinki-NLP/opus-mt (MarianMT via HuggingFace) |
| STT | OpenAI Whisper |
| Task Queue | Background workers (placeholder) |
| Validation | Pydantic v2 + pydantic-settings |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5 |
| UI | Tailwind CSS 4, Radix UI, Lucide icons |
| State | React Context (AuthContext) |
| Data Fetching | @tanstack/react-query 5, native fetch |
| HTTP Client | Custom fetch wrapper (apiClient + http) |
| Real-time | WebSocket (native), socket.io-client |
| Components | shadcn/ui |

---

## 3. Backend Architecture

### 3.1 Core Configuration

**File**: `backend/app/core/config.py`

```python
class Settings(BaseSettings):
    # App
    APP_NAME: str = "Intelligent Virtual Exhibition Platform"
    ENV: Literal["dev", "prod"] = "dev"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # JWT
    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # MongoDB
    MONGO_URI: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "ivep_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI / Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    EMBEDDING_MODEL: str = "multilingual-e5-small"
```

- Loaded from `.env` file via pydantic-settings
- Cached via `@lru_cache` on `get_settings()`

### 3.2 Security & Auth

**File**: `backend/app/core/security.py`

| Function | Description |
|----------|-------------|
| `get_password_hash(password)` | Hash password using Argon2 via passlib |
| `hash_password(password)` | Backward-compatible alias |
| `verify_password(plain, hashed)` | Verify password against hash |
| `create_access_token(subject?, expires_delta?, data?)` | Create JWT access token with `type: "access"` |
| `create_refresh_token(data, expires_delta?)` | Create JWT refresh token with `type: "refresh"` |
| `decode_token(token)` | Decode & validate JWT, returns payload or None |
| `verify_token_type(token, expected_type)` | Decode + verify token type (`"access"` / `"refresh"`) |

**Token payload structure**:
```json
{
  "sub": "<user_id>",
  "role": "<role_value>",
  "exp": "<expiration_timestamp>",
  "type": "access" | "refresh"
}
```

### 3.3 Dependency Injection

**File**: `backend/app/core/dependencies.py`

| Dependency | Description |
|------------|-------------|
| `get_current_user` | Extracts JWT from `Authorization: Bearer <token>`, validates, returns user dict. Supports `test-token` bypass in dev (returns visitor-456). |
| `get_current_user_ws` | Same but token via query parameter (for WebSocket connections) |
| `verify_jwt_token(token)` | Core JWT verification logic: tries `verify_token_type`, falls back to direct decode, fetches user from MongoDB, normalizes role to `Role` enum |
| `require_role(role)` | Factory: returns dependency that enforces a single role |
| `require_roles(roles)` | Factory: returns dependency that enforces one of multiple roles |
| `require_feature(feature_name)` | Factory: checks organizer's subscription plan features (e.g., `max_events`, `analytics_export`) |

**Security scheme**: `HTTPBearer` (expects `Authorization: Bearer <jwt>`)

### 3.4 Database Layer

**File**: `backend/app/db/mongo.py`

- **MongoDB client**: `motor.motor_asyncio.AsyncIOMotorClient`
- **Singleton pattern**: `MongoDB` class with `client` and `db` attributes
- `connect_to_mongo()` — connects using `settings.MONGO_URI` and selects `settings.DATABASE_NAME`
- `close_mongo_connection()` — closes the client
- `get_database()` — returns the active database instance

**File**: `backend/app/db/utils.py`

- `stringify_object_ids(obj)` — Recursively converts `bson.ObjectId` to strings; adds `id` mirror from `_id`

**File**: `backend/app/core/store.py`

- Legacy in-memory data store with `FAKE_USERS`, `FAKE_ORGANIZATIONS`, `FAKE_ORG_MEMBERS`
- Pre-seeded users: `admin@ivep.com` / `admin123`, `organizer@ivep.com` / `organizer123`, `visitor@ivep.com` / `visitor123`
- Still referenced by subscriptions module for `FAKE_ORGANIZATIONS`

### 3.5 Application Entry Point

**File**: `backend/app/main.py`

**Lifespan events**:
- **Startup**: Setup logging → Connect to MongoDB → Ensure indexes
- **Shutdown**: Close MongoDB connection

**CORS**: All origins allowed (`["*"]`), all methods, all headers, credentials enabled

**Registered Routers** (all prefixed with `/api/v1`):

| Router | Prefix | Tags |
|--------|--------|------|
| auth_router | `/auth` | Authentication |
| users_router | `/users` | Users |
| organizations_router | `/organizations` | Organizations |
| events_router | `/events` | Events |
| participants_router | `/events/{event_id}/participants` | Participants |
| stands_router | `/events/{event_id}/stands` | Stands |
| subscriptions_router | `/subscriptions` | Subscriptions |
| analytics_router | `/analytics` | Analytics |
| notifications_router | `/notifications` | Notifications |
| favorites_router | `/favorites` | Favorites |
| chat_router | `/chat` | chat |
| rag_router | `/assistant` | assistant |
| translation_router | `/translation` | translation |
| transcripts_router | `/transcripts` | transcripts |
| meetings_router | `/meetings` | meetings |
| resources_router | `/resources` | resources |
| leads_router | `/leads` | leads |
| recommendations_router | `/recommendations` | recommendations |
| dev_router (dev only) | `/dev` | Development |

**Root endpoints**:
- `GET /` → `{"message": "Welcome to IVEP API"}`
- `GET /health` → `{"status": "healthy"}`

---

## 4. Roles & Enums

### User Roles (`app/modules/auth/enums.py`)

```python
class Role(str, Enum):
    ADMIN = "admin"
    ORGANIZER = "organizer"
    ENTERPRISE = "enterprise"
    VISITOR = "visitor"
```

### Event States (`app/modules/events/schemas.py`)

```python
class EventState(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    LIVE = "live"
    CLOSED = "closed"
```

### Participant Status (`app/modules/participants/schemas.py`)

```python
class ParticipantStatus(str, Enum):
    INVITED = "invited"
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"
```

### Meeting Status (`app/modules/meetings/schemas.py`)

```python
class MeetingStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELED = "canceled"
    COMPLETED = "completed"
```

### Notification Types (`app/modules/notifications/schemas.py`)

```python
class NotificationType(str, Enum):
    EVENT_APPROVED = "event_approved"
    INVITATION_SENT = "invitation_sent"
    PARTICIPANT_ACCEPTED = "participant_accepted"
```

### Analytics Event Types (`app/modules/analytics/schemas.py`)

```python
class AnalyticsEventType(str, Enum):
    EVENT_VIEW = "event_view"
    STAND_VISIT = "stand_visit"
    CHAT_OPENED = "chat_opened"
```

### Subscription Plans (`app/modules/subscriptions/schemas.py`)

```python
class SubscriptionPlan(str, Enum):
    FREE = "free"
    PRO = "pro"
```

**Plan Features**:
| Feature | FREE | PRO |
|---------|------|-----|
| max_events | 1 | -1 (unlimited) |
| analytics_export | False | True |
| priority_support | False | True |

### Organization Member Roles (`app/modules/organizations/schemas.py`)

```python
class OrgMemberRole(str, Enum):
    OWNER = "owner"
    MANAGER = "manager"
    MEMBER = "member"
```

### Favorite Targets (`app/modules/favorites/schemas.py`)

```python
FavoriteTarget = Literal["event", "stand", "organization"]
```

---

## 5. Backend Modules — Schemas

### 5.1 Auth Schemas (`auth/schemas.py`)

| Schema | Fields |
|--------|--------|
| **LoginRequest** | `email: EmailStr`, `password: str` |
| **RegisterRequest** | `email: EmailStr`, `username: str`, `password: str`, `full_name: str`, `role: Role = VISITOR` |
| **TokenResponse** | `access_token: str`, `refresh_token: str`, `token_type: str = "bearer"`, `user: UserRead` |

### 5.2 User Schemas (`users/schemas.py`)

| Schema | Fields |
|--------|--------|
| **ProfessionalInfo** | `job_title?: str`, `industry?: str`, `company?: str`, `experience_level?: str` |
| **EventPreferences** | `types?: list[str]`, `languages?: list[str]`, `regions?: list[str]` |
| **EngagementSettings** | `recommendations_enabled: bool = True`, `email_notifications: bool = True` |
| **UserBase** | `id: str (alias _id)`, `email: EmailStr`, `username: str`, `full_name: str`, `role: Role`, `is_active: bool = True`, `created_at: datetime` |
| **UserCreate** | `email: EmailStr`, `username: str`, `password: str`, `full_name: str`, `role: Role = VISITOR` |
| **UserRead** | `id: str (alias _id)`, `email`, `username?`, `full_name`, `role`, `is_active`, `created_at`, `bio?`, `language?`, `avatar_url?`, `professional_info?: ProfessionalInfo`, `interests?: list[str]`, `event_preferences?: EventPreferences`, `networking_goals?: list[str]`, `engagement_settings?: EngagementSettings` |
| **UserUpdate** | `email?`, `username?`, `full_name?`, `role?`, `is_active?` |
| **ProfileUpdate** | `full_name?`, `bio?`, `language?`, `avatar_url?`, `professional_info?`, `interests?`, `event_preferences?`, `networking_goals?`, `engagement_settings?` |

### 5.3 Event Schemas (`events/schemas.py`)

| Schema | Fields |
|--------|--------|
| **EventBase** | `id: str (alias _id or id)`, `title: str`, `description?: str`, `organizer_id: str`, `state: EventState`, `banner_url?: str`, `category?: str = "Exhibition"`, `start_date: datetime`, `end_date: datetime`, `location?: str = "Virtual Platform"`, `tags: list[str] = []`, `organizer_name?: str`, `created_at: datetime` |
| **EventCreate** | `title: str`, `description?`, `category? = "Exhibition"`, `start_date?`, `end_date?`, `location? = "Virtual Platform"`, `banner_url?`, `tags? = []`, `organizer_name?` |
| **EventUpdate** | All fields optional: `title?`, `description?`, `category?`, `start_date?`, `end_date?`, `location?`, `banner_url?`, `tags?`, `organizer_name?` |
| **EventRead** | Extends `EventBase` (no additional fields) |
| **EventsResponse** | `events: list[EventRead]`, `total: int` |

### 5.4 Stand Schemas (`stands/schemas.py`)

| Schema | Fields |
|--------|--------|
| **StandBase** | `id: str (alias _id)`, `event_id: str`, `organization_id: str`, `name: str`, `description?: str`, `logo_url?: str`, `tags?: list[str] = []`, `stand_type?: str = "standard"` (standard/premium/sponsor), `theme_color?: str = "#1e293b"`, `stand_background_url?: str`, `presenter_avatar_bg?: str = "#ffffff"`, `created_at: datetime` |
| **StandCreate** | `organization_id: str`, `name: str`, `description?`, `logo_url?`, `tags?`, `stand_type?`, `theme_color?`, `stand_background_url?`, `presenter_avatar_bg?` |
| **StandRead** | Same as StandBase |
| **StandUpdate** | All optional: `name?`, `description?`, `logo_url?`, `tags?`, `stand_type?`, `theme_color?`, `stand_background_url?`, `presenter_avatar_bg?` |

### 5.5 Chat Schemas (`chat/schemas.py`)

| Schema | Fields |
|--------|--------|
| **MessageSchema** | `id?: PyObjectId (alias _id)`, `room_id: str`, `sender_id: str`, `sender_name: str`, `content: str`, `type: str = "text"` (text/image/file), `timestamp: datetime` |
| **ChatRoomSchema** | `id?: PyObjectId (alias _id)`, `name?: str`, `type: str = "direct"` (direct/group/stand), `members: List[str]`, `created_at: datetime`, `last_message?: dict` |
| **MessageCreate** | `room_id: str`, `content: str`, `type: str = "text"` |

### 5.6 Resource Schemas (`resources/schemas.py`)

| Schema | Fields |
|--------|--------|
| **ResourceBase** | `title: str`, `description?: str`, `stand_id: str`, `type: str` (pdf/video/image/document), `tags: List[str] = []` |
| **ResourceCreate** | extends ResourceBase + `file_path: str`, `file_size: int`, `mime_type: str` |
| **ResourceSchema** | extends ResourceCreate + `id: str (alias _id)`, `upload_date: datetime`, `downloads: int = 0` |

### 5.7 Participant Schemas (`participants/schemas.py`)

| Schema | Fields |
|--------|--------|
| **ParticipantBase** | `id: str (alias _id)`, `event_id: str`, `user_id: str`, `status: ParticipantStatus`, `created_at: datetime` |
| **ParticipantRead** | Same fields as ParticipantBase |

### 5.8 Notification Schemas (`notifications/schemas.py`)

| Schema | Fields |
|--------|--------|
| **NotificationBase** | `id: str (alias _id)`, `user_id: str`, `type: str`, `message: str`, `is_read: bool`, `created_at: datetime` |
| **NotificationRead** | Same as NotificationBase |

### 5.9 Favorite Schemas (`favorites/schemas.py`)

| Schema | Fields |
|--------|--------|
| **FavoriteCreate** | `target_type: FavoriteTarget` ("event"/"stand"/"organization"), `target_id: str` |
| **FavoriteRead** | `id: str (alias _id)`, `user_id: str`, `target_type: FavoriteTarget`, `target_id: str`, `created_at: datetime` |

### 5.10 Meeting Schemas (`meetings/schemas.py`)

| Schema | Fields |
|--------|--------|
| **MeetingBase** | `visitor_id: str`, `stand_id: str`, `start_time: datetime`, `end_time: datetime`, `purpose?: str` |
| **MeetingCreate** | Same as MeetingBase |
| **MeetingUpdate** | `status: MeetingStatus`, `notes?: str` |
| **MeetingSchema** | extends MeetingBase + `id: str (alias _id)`, `status: MeetingStatus = PENDING`, `created_at: datetime`, `updated_at: datetime` |
| **AvailabilitySlot** | `start_time: datetime`, `end_time: datetime`, `is_available: bool = True` |

### 5.11 AI RAG Schemas (`ai_rag/schemas.py`)

| Schema | Fields |
|--------|--------|
| **QueryRequest** | `query: str`, `session_id?: str`, `stream: bool = True` |
| **IngestRequest** | `source_url?: str`, `content?: str`, `metadata?: dict` |
| **AssistantMessage** | `role: str` (user/assistant), `content: str`, `timestamp: datetime` |
| **SessionResponse** | `session_id: str`, `messages: List[AssistantMessage]`, `created_at: datetime` |

### 5.12 AI Translation Schemas (`ai_translation/schemas.py`)

| Schema | Fields |
|--------|--------|
| **TranslationRequest** | `text: str`, `target_lang: str`, `source_lang?: str` |
| **TranslationResponse** | `original_text: str`, `translated_text: str`, `source_lang: str`, `target_lang: str` |
| **LanguageDetectionRequest** | `text: str` |
| **LanguageDetectionResponse** | `language: str`, `confidence: float` |

### 5.13 Analytics Schemas (`analytics/schemas.py`)

| Schema | Fields |
|--------|--------|
| **KPIMetric** | `label: str`, `value: float`, `unit?: str`, `trend?: float` |
| **TimeSeriesPoint** | `timestamp: datetime`, `value: float` |
| **DashboardData** | `kpis: List[KPIMetric]`, `main_chart: List[TimeSeriesPoint]`, `distribution: Dict[str, float]`, `recent_activity: List[dict]` |
| **AnalyticsRequest** | `start_date?: datetime`, `end_date?: datetime`, `granularity: str = "day"` |
| **AnalyticsEventCreate** | `type: AnalyticsEventType`, `user_id?: UUID`, `event_id?: UUID`, `stand_id?: UUID` |
| **AnalyticsEventRead** | extends AnalyticsEventCreate + `id: UUID`, `created_at: datetime` |

### 5.14 Recommendation Schemas (`recommendations/schemas.py`)

| Schema | Fields |
|--------|--------|
| **RecommendationItem** | `id: str`, `title: str`, `type: str` (event/stand/resource), `score: float`, `reason?: str`, `image_url?: str` |

### 5.15 Lead Schemas (`leads/schemas.py`)

| Schema | Fields |
|--------|--------|
| **LeadInteraction** | `visitor_id: str`, `stand_id: str`, `interaction_type: str` (visit/resource_download/chat/meeting), `metadata: Dict[str, str] = {}`, `timestamp: datetime` |
| **LeadSchema** | `id: str (alias _id)`, `visitor_id: str`, `stand_id: str`, `visitor_name: str`, `email: str`, `score: int = 0`, `tags: List[str] = []`, `last_interaction: datetime`, `interactions_count: int = 0` |
| **ConnectionRequest** | `from_user_id: str`, `to_user_id: str`, `status: str = "pending"`, `message?: str`, `created_at: datetime` |

### 5.16 Subscription Schemas (`subscriptions/schemas.py`)

| Schema | Fields |
|--------|--------|
| **SubscriptionAssign** | `organization_id: UUID`, `plan: SubscriptionPlan` |
| **SubscriptionRead** | `organization_id: UUID`, `plan: SubscriptionPlan` |

### 5.17 Organization Schemas (`organizations/schemas.py`)

| Schema | Fields |
|--------|--------|
| **OrganizationCreate** | `name: str`, `description?: str` |
| **OrganizationRead** | `id: str (alias _id)`, `name: str`, `description?: str`, `owner_id: str`, `created_at: datetime` |
| **OrganizationUpdate** | `name?: str`, `description?: str` |
| **OrganizationMember** | `user_id: str`, `organization_id: str`, `role_in_org: OrgMemberRole = MEMBER`, `joined_at: datetime` |

---

## 6. Backend Modules — API Endpoints

### 6.1 Auth (`/api/v1/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | None | Login with email/password, returns tokens + user |
| POST | `/auth/register` | None | Register new user, returns tokens + user |
| POST | `/auth/refresh` | None | Refresh access token using refresh_token |
| GET | `/auth/admin-only` | ADMIN | RBAC test route |
| GET | `/auth/organizer-only` | ORGANIZER | RBAC test route |

### 6.2 Users (`/api/v1/users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | Any authenticated | Get current user profile |
| PUT | `/users/me` | Any authenticated | Update current user profile (ProfileUpdate) |

### 6.3 Events (`/api/v1/events`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/events/joined` | Any authenticated | Get events where user is APPROVED participant |
| GET | `/events/{event_id}/my-status` | Any authenticated | Get user's participation status for an event |
| POST | `/events/{event_id}/join` | VISITOR | Join/request to join an event |
| GET | `/events/organizer/my-events` | ORGANIZER | Get organizer's own events |
| POST | `/events/` | ORGANIZER | Create new event (DRAFT state) |
| GET | `/events/` | None (public) | List all events with filters (organizer_id, state, category, search) |
| GET | `/events/{event_id}` | None (public) | Get event by ID |
| PATCH | `/events/{event_id}` | ORGANIZER (owner) | Update event fields |
| DELETE | `/events/{event_id}` | ORGANIZER (owner) | Delete event |
| POST | `/events/{event_id}/submit` | ORGANIZER (owner) | Submit for approval (DRAFT → PENDING_APPROVAL) |
| POST | `/events/{event_id}/approve` | ADMIN | Approve event (PENDING_APPROVAL → APPROVED) + notification |
| POST | `/events/{event_id}/start` | ADMIN / ORGANIZER (owner) | Start event (APPROVED → LIVE) |
| POST | `/events/{event_id}/close` | ADMIN / ORGANIZER (owner) | Close event (LIVE → CLOSED) |

### 6.4 Participants (`/api/v1/events/{event_id}/participants`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/events/{event_id}/participants/invite` | ADMIN / ORGANIZER | Invite user (body: `{user_id}`) + notification |
| POST | `/events/{event_id}/participants/request` | VISITOR / ENTERPRISE | Request to join event |
| POST | `/events/{event_id}/participants/{participant_id}/approve` | ADMIN / ORGANIZER | Approve participant + notification |
| POST | `/events/{event_id}/participants/{participant_id}/reject` | ADMIN / ORGANIZER | Reject participant |
| GET | `/events/{event_id}/participants/` | ADMIN / ORGANIZER | List event participants |

### 6.5 Stands (`/api/v1/events/{event_id}/stands`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/events/{event_id}/stands/` | ADMIN / ORGANIZER | Assign stand to organization (one per org per event) |
| GET | `/events/{event_id}/stands/` | None (public) | List all stands for event |
| GET | `/events/{event_id}/stands/{stand_id}` | None (public) | Get stand details |
| PATCH | `/events/{event_id}/stands/{stand_id}` | ADMIN / ORGANIZER | Update stand details |

### 6.6 Organizations (`/api/v1/organizations`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/organizations/create` | ADMIN / ORGANIZER | Create organization |
| POST | `/organizations/invite` | ADMIN / ORGANIZER (owner) | Invite user to org (body: `{organization_id, email, role_in_org}`) |
| GET | `/organizations/` | Any authenticated | List all organizations |

### 6.7 Subscriptions (`/api/v1/subscriptions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/subscriptions/assign` | ADMIN | Assign plan to organization |
| GET | `/subscriptions/org/{organization_id}` | ADMIN / ORGANIZER (owner) | Get org's subscription plan |

### 6.8 Notifications (`/api/v1/notifications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications/` | Any authenticated | Get current user's notifications |
| POST | `/notifications/mark-all-read` | Any authenticated | Mark all notifications as read |
| POST | `/notifications/{notification_id}/read` | Any authenticated | Mark single notification as read |

### 6.9 Favorites (`/api/v1/favorites`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/favorites/` | Any authenticated | List user's favorites |
| POST | `/favorites/` | Any authenticated | Add favorite (body: `{target_type, target_id}`) |
| DELETE | `/favorites/{favorite_id}` | Any authenticated | Remove favorite |

### 6.10 Chat (`/api/v1/chat`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/chat/rooms` | Any authenticated | Get user's chat rooms |
| GET | `/chat/rooms/{room_id}/messages` | Any authenticated | Get room message history (params: limit, skip) |
| POST | `/chat/rooms/stand/{stand_id}` | Any authenticated | Initiate/get direct chat with stand owner |
| WS | `/chat/ws/chat/{room_id}?token=<jwt>` | JWT via query | WebSocket for real-time messaging |

### 6.11 Meetings (`/api/v1/meetings`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/meetings/` | Any authenticated | Request a meeting (visitor_id must match current user) |
| GET | `/meetings/my-meetings` | Any authenticated | Get current user's meetings |
| GET | `/meetings/stand/{stand_id}` | Any authenticated | Get meetings for a stand |
| PATCH | `/meetings/{meeting_id}` | Any authenticated | Update meeting status |

### 6.12 Resources (`/api/v1/resources`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/resources/upload` | Any authenticated | Upload resource (multipart form: stand_id, title, type, description, file) |
| GET | `/resources/stand/{stand_id}` | None (public) | Get stand's resource catalog |
| GET | `/resources/{resource_id}/track` | None (public) | Track/increment resource download |

### 6.13 Leads (`/api/v1/leads`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/leads/stand/{stand_id}` | Any authenticated | Get leads for a stand |
| POST | `/leads/interactions` | Any authenticated | Log visitor interaction |
| GET | `/leads/export/{stand_id}` | Any authenticated | Export leads (mock CSV) |

### 6.14 Analytics (`/api/v1/analytics`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/analytics/log` | Any authenticated | Log analytics event |
| GET | `/analytics/` | ADMIN / ORGANIZER | Get all analytics events |
| GET | `/analytics/stand/{id}` | Any authenticated | Get stand metrics (DashboardData) |
| GET | `/analytics/event/{id}` | Any authenticated | Get event metrics (DashboardData) |
| GET | `/analytics/platform` | Any authenticated | Get platform-wide metrics |

### 6.15 AI Assistant / RAG (`/api/v1/assistant`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/assistant/{scope}/query` | Any authenticated | Stream AI response (SSE) using RAG retrieval |
| POST | `/assistant/{scope}/query-with-sources` | Any authenticated | Non-streaming query with source attribution |
| POST | `/assistant/{scope}/ingest` | Any authenticated | Ingest document into vector store |
| POST | `/assistant/{scope}/ingest-text` | Any authenticated | Ingest raw text into knowledge base |
| GET | `/assistant/{scope}/stats` | Any authenticated | Get vector store statistics for scope |
| DELETE | `/assistant/{scope}/documents` | Any authenticated | Delete documents from knowledge base |
| GET | `/assistant/session/{id}` | Any authenticated | Get chat session history (TODO) |

**Scope values**: `"platform"`, `"event-{event_id}"`, `"stand-{stand_id}"`

### 6.16 Translation (`/api/v1/translation`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/translation/translate` | Any authenticated | Translate text to target language |
| POST | `/translation/detect-language` | Any authenticated | Detect language of text |

### 6.17 Transcripts (`/api/v1/transcripts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/transcripts/transcribe` | Any authenticated | Transcribe base64 audio (Whisper) |
| POST | `/transcripts/transcribe-file` | Any authenticated | Transcribe uploaded audio file |
| POST | `/transcripts/detect-language` | Any authenticated | Detect audio language |
| GET | `/transcripts/languages` | Any authenticated | List supported languages |
| WS | `/transcripts/ws/live/{room_id}` | None | WebSocket for live audio transcription |

### 6.18 Recommendations (`/api/v1/recommendations`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/recommendations/track-interaction` | Any authenticated | Track user interaction for CF |
| GET | `/recommendations/events` | Any authenticated | Get recommended events for current user |
| GET | `/recommendations/user/{user_id}` | Any authenticated | Get personalized recommendations |
| POST | `/recommendations/user/{user_id}/personalized` | Any authenticated | Get recs with custom history |
| GET | `/recommendations/events/{event_id}` | Any authenticated | Get recs for an event (stands/resources) |
| GET | `/recommendations/enterprise/{enterprise_id}` | Any authenticated | Get recommended leads for enterprise |

### 6.19 Dev (`/api/v1/dev`) — dev/debug mode only

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/dev/seed-data` | None | Seed database with test data (users, orgs, events, stands, resources) |

---

## 7. Frontend Architecture

### 7.1 Dependencies

```json
{
  "@tanstack/react-query": "^5.90.21",
  "axios": "^1.13.5",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.564.0",
  "next": "16.1.6",
  "radix-ui": "^1.4.3",
  "react": "19.2.3",
  "react-dom": "19.2.3",
  "socket.io-client": "^4.8.3",
  "tailwind-merge": "^3.4.0"
}
```

Dev: `tailwindcss@4`, `shadcn@3.8.4`, `typescript@5`, `eslint-config-next`

### 7.2 Pages & Routing

**Root Layout** (`src/app/layout.tsx`):
- Wraps app in `<AuthProvider>` → `<Navbar>` → `<main>{children}</main>` → `<FloatingAssistant>` → `<Footer>`
- Font: Inter
- Title: "IVEP - Intelligent Virtual Exhibition Platform"

**All pages** (`src/app/**/page.tsx`):

| Path | Description |
|------|-------------|
| `/` | Landing page (hero + features + CTA) |
| `/auth/login` | Login page |
| `/auth/register` | Registration page |
| `/events` | Events listing/browsing |
| `/events/[id]` | Event detail page |
| `/events/[id]/live` | Live event view |
| `/events/[id]/stands/[standId]` | Stand detail page |
| `/events/[id]/live/stands/[standId]` | Live stand view |
| `/dashboard` | User dashboard |
| `/profile` | User profile |
| `/favorites` | Favorites page |
| `/assistant` | AI assistant page |
| `/webinars` | Webinars page |
| `/(organizer)/organizer` | Organizer dashboard |
| `/(organizer)/organizer/events` | Organizer events list |
| `/(organizer)/organizer/events/new` | Create new event |
| `/(organizer)/organizer/profile` | Organizer profile |
| `/(organizer)/organizer/subscription` | Subscription management |

### 7.3 Auth Context

**File**: `src/context/AuthContext.tsx`

**State**: `user: User | null`, `tokens: AuthTokens | null`, `isAuthenticated: boolean`, `isLoading: boolean`

**Methods**:
- `login(credentials)` → calls `authService.login()`, stores tokens + user in localStorage, redirects based on role (organizer → `/organizer`, others → `/`)
- `register(userData)` → same flow via `authService.register()`
- `logout()` → clears state + localStorage, redirects to `/`

**Session restoration**: On mount, reads `auth_tokens` and `auth_user` from localStorage.

**Redirect**: Supports `redirectAfterLogin` via localStorage.

### 7.4 HTTP Client Layer

**Two HTTP clients exist**:

1. **`src/lib/http.ts`** — Simple fetch wrapper used by `services/*.service.ts`
   - Auto-attaches token from `localStorage.auth_tokens`
   - Redirects to `/auth/login` on 401
   - Methods: `http.get()`, `http.post()`, `http.put()`, `http.patch()`, `http.delete()`

2. **`src/lib/api/client.ts`** — Advanced fetch wrapper with token refresh
   - Uses `getStoredTokens()` from `src/lib/auth.ts`
   - **Silent token refresh**: On 401, calls `/auth/refresh` with refresh_token, retries original request
   - Handles concurrent refresh (subscriber pattern)
   - Methods: `apiClient.get()`, `apiClient.post()`, `apiClient.put()`, `apiClient.patch()`, `apiClient.delete()`

**Config** (`src/lib/config.ts`):
```typescript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const API_PREFIX = '/api/v1';
export const getApiUrl = (endpoint: string) => `${API_BASE_URL}${API_PREFIX}${endpoint}`;
```

**Auth helpers** (`src/lib/auth.ts`):
- `getStoredTokens()` — reads `auth_tokens` from localStorage
- `getAccessToken()` — returns current access_token

### 7.5 API Endpoints Map

**File**: `src/lib/api/endpoints.ts`

```typescript
ENDPOINTS = {
  USERS: { ME, PROFILE },
  ORGANIZER: { MY_EVENTS },
  EVENTS: { LIST, GET(id), JOINED, MY_STATUS(id), JOIN(id), SUBMIT(id), APPROVE(id), START(id), CLOSE(id), DELETE(id) },
  PARTICIPANTS: { LIST(eventId), INVITE(eventId), REQUEST(eventId), APPROVE(eventId, participantId), REJECT(eventId, participantId) },
  RECOMMENDATIONS: { EVENTS },
  NOTIFICATIONS: { LIST, MARK_READ(id), MARK_ALL_READ },
  STANDS: { LIST(eventId), GET(eventId, standId), CREATE(eventId) },
  ORGANIZATIONS: { LIST, CREATE, INVITE },
  RESOURCES: { LIST(standId), UPLOAD },
  CHAT: { ROOMS, START(standId), HISTORY(roomId) },
  MEETINGS: { REQUEST },
  TRANSCRIPTS: { UPLOAD },
  FAVORITES: { LIST, ADD, DELETE(id) },
}
```

### 7.6 TypeScript Types

**`src/types/user.ts`**:
- `User` — `id, email, full_name?, username, role ('admin'|'organizer'|'visitor'), created_at?, is_active?, avatar_url?, bio?, language?, professional_info?, interests?, event_preferences?, networking_goals?, engagement_settings?`
- `ProfileUpdatePayload` — partial profile fields
- `AuthTokens` — `access_token, refresh_token?, token_type`
- `AuthResponse` — `user + access_token + refresh_token + token_type`
- `ProfessionalInfo`, `EventPreferences`, `EngagementSettings`

**`src/types/event.ts`**:
- `EventStatus = 'draft' | 'pending_approval' | 'approved' | 'live' | 'closed'`
- `OrganizerEvent` — `id, title, description?, organizer_id, state: EventStatus, banner_url?, category?, start_date, end_date, location?, tags, created_at, organizer_name?`
- `EventCreatePayload`, `EventUpdatePayload`

**`src/types/stand.ts`**:
- `Stand` — `id, event_id, organization_id, name, description?, logo_url?, banner_url?, website_url?, tags?, stand_type?, theme_color?, stand_background_url?, presenter_avatar_bg?, created_at`
- `StandCreatePayload`, `StandUpdatePayload`

**`src/types/organizer.ts`**:
- `Organization` — `id, name, description?, owner_id, created_at`
- `OrganizerProfile extends User` — `organization?: Organization`
- `StatCard` — `label, value, change?, trend?`

**`src/types/chat.ts`**: Empty file

**`src/lib/api/types.ts`** (additional types):
- `ParticipantStatus = 'NOT_JOINED' | 'INVITED' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PENDING'`
- `Notification` — `id, user_id, type, message, is_read, created_at`
- `Recommendation` — `id, title, description, type ('event'|'stand'|'resource'), score, reason?`
- `ParticipationStatus` — `status: ParticipantStatus, participant_id: string | null`
- `Resource` — `id, title, description?, type, file_path, file_size, stand_id, downloads`

### 7.7 Hooks

| Hook | File | Description |
|------|------|-------------|
| `useAuth` | `src/hooks/useAuth.ts` | Wraps `useContext(AuthContext)` |
| `useChat` | `src/hooks/useChat.ts` | Empty |
| `useChatWebSocket` | `src/hooks/useChatWebSocket.ts` | WebSocket connection for chat rooms. Manages messages, connection state, reconnection. Uses `ws://127.0.0.1:8000/api/v1/chat/ws/chat/{roomId}?token=<jwt>` |
| `useEvents` | `src/hooks/useEvents.ts` | Empty |
| `useNotifications` | `src/hooks/useNotifications.ts` | Empty |
| `useStands` | `src/hooks/useStands.ts` | Empty |

### 7.8 Services

| Service | File | Methods |
|---------|------|---------|
| `authService` | `src/services/auth.service.ts` | `login(credentials)`, `register(userData)`, `refresh(refreshToken)`, `logout()` — uses `http` client |
| `eventsService` | `src/services/events.service.ts` | `getEvents(params)`, `getEventById(id)` — uses `http` client |
| `favoritesService` | `src/services/favorites.service.ts` | `list()`, `add(target_type, target_id)`, `remove(favoriteId)` — uses `apiClient` |
| `assistantService` | `src/services/assistant.service.ts` | `streamAssistantQuery({scope, query, token, signal, onTokenChunk})` — SSE streaming, `queryWithSources({scope, query, ...})` — non-streaming |
| `chatService` | `src/services/chat.service.ts` | Empty |
| `standsService` | `src/services/stands.service.ts` | Empty |

**API layer** (`src/lib/api/`):
- `eventsApi` — `getOrganizerEvents()`, `getEventById(id)`, `createEvent(data)`, `updateEvent(id, data)`, `deleteEvent(id)`, `submitEvent(id)`, `startEvent(id)`, `closeEvent(id)` — uses `apiClient`
- `notificationsApi` — `getNotifications()`, `markAsRead(id)`, `markAllRead()` — uses `apiClient`
- `organizerApi` — `getProfile()`, `updateProfile(data)` — uses `apiClient`

---

## 8. AI & ML Layer

### 8.1 RAG Assistant (`ai_rag/`)

**Files**: `service.py`, `vector_store.py`, `chunker.py`, `router.py`, `schemas.py`

**RAGService** (`service.py`):
- `ingest_document(content, scope, source, **metadata)` — chunks document → embeds into ChromaDB
- `retrieve_context(query, scope, top_k)` — semantic search in vector store
- `stream_query(query, scope, use_retrieval, model, top_k)` — retrieves context from vector store + MongoDB facts, streams concatenated results (no external LLM call)
- `query_with_sources(query, scope, top_k, model)` — non-streaming with source attribution
- `_retrieve_db_facts(query, scope, top_k)` — searches MongoDB for stand/event/resource facts based on scope
- `get_stats(scope)` — vector store collection stats

**Scopes**: `"platform"`, `"event-{id}"`, `"stand-{id}"`

**Vector Store**: ChromaDB with multilingual-e5-small embeddings via Ollama

### 8.2 Translation (`ai_translation/`)

**Files**: `service.py`, `translation_model.py`, `language_detector.py`, `router.py`, `schemas.py`

- `MarianTranslator` — uses Helsinki-NLP/opus-mt models for language pair translation
- `language_detector.py` — uses `langdetect` library for language identification
- Service combines detection + translation

### 8.3 Recommendations (`recommendations/`)

**Files**: `recommendation_engine.py`, `embedding_service.py`, `router.py`, `schemas.py`

- `HybridRecommender` — combines content-based (TF-IDF) + collaborative filtering
- `record_interaction(user_id, item_id, interaction_type, metadata)` — tracks interactions
- `recommend(user_id, user_history, candidate_items, top_k)` — generates ranked recommendations
- Uses sample catalog data with fallback to live events from database

### 8.4 Transcripts (`transcripts/`)

**Files**: `whisper_service.py`, `router.py`

- `WhisperService` — interface for OpenAI Whisper models (tiny → large)
- Supports batch file transcription and live WebSocket streaming
- Language detection from audio

---

## 9. Workers (Background Tasks)

**Directory**: `backend/app/workers/tasks/`

| File | Status | Purpose |
|------|--------|---------|
| `embeddings.py` | Empty (placeholder) | Batch processing of content embeddings for RAG |
| `recommendations.py` | Empty (placeholder) | Scheduled updates for recommendation interaction matrix |
| `transcripts.py` | Empty (placeholder) | Async processing of long audio files |

---

## 10. Scripts & Tests

### Scripts

**`backend/scripts/seed_data.py`**:
- Idempotent seed script (upserts by unique fields)
- Creates: Admin (`admin@demo.com`), Organizer (`organizer@demo.com`), Visitor (`visitor@demo.com`) — password: `Password123!`
- Creates events: "Future Tech Expo" (LIVE), "Healthcare Innovations Summit" (APPROVED)
- Creates stands with resources (brochure PDF + demo video)
- Creates participant entries, notifications, favorites

### Tests

**`backend/tests/`**:

| File | Description |
|------|-------------|
| `diagnose_client.py` | Checks httpx/starlette compatibility |
| `integration_check.py` | Tests protected HTTP endpoints with/without token |
| `test_flow_week2_3.py` | Integration test flow: login → CRUD → state transitions |
| `test_flow_week3_4.py` | Integration test flow: extended features |

Test credentials: `admin@ivep.com`/`admin123`, `organizer@ivep.com`/`organizer123`, `visitor@ivep.com`/`visitor123`

### Dev Seed Endpoint

`POST /api/v1/dev/seed-data` — Creates:
- 8 users (admin, organizer, 3 enterprise, 3 visitors) — password: `password123`
- 4 organizations (IVEP Events, TechCorp AI, EcoSoft Solutions, EduSys Global)
- 2 events (AI & Innovation Expo 2026, GreenTech Virtual Summit) → set to LIVE
- Stands: TechCorp, EduSys, EcoSoft stands with brochures and demo videos

---

## 11. Database Indexes

**Collection** → **Indexes**:

| Collection | Indexes |
|------------|---------|
| `users` | `email` (unique), `role`, `is_active` |
| `organizations` | `owner_id`, `created_at` |
| `events` | `organizer_id`, `state`, `created_at`, `title` (text) |
| `participants` | `(event_id, user_id)` (unique compound), `status` |
| `stands` | `(event_id, organization_id)` (unique compound), `name` |
| `resources` | `stand_id`, `upload_date`, `downloads`, `(title, tags)` (text) |
| `meetings` | `stand_id`, `visitor_id`, `status`, `start_time` |
| `leads` | `(visitor_id, stand_id)` (unique compound), `score`, `last_interaction` |
| `lead_interactions` | `stand_id`, `visitor_id`, `timestamp` |
| `chat_rooms` | `members`, `created_at` |
| `chat_messages` | `room_id`, `timestamp` |
| `notifications` | `user_id`, `created_at`, `type` |
| `subscriptions` | `organization_id` (unique), `plan` |
| `assistant_sessions` | `scope`, `user_id` |
| `assistant_messages` | `session_id`, `timestamp` |
| `analytics_events` | `event_id`, `stand_id`, `user_id`, `type`, `timestamp` |

---

## 12. MongoDB Collections

Based on indexes and code analysis, the following collections are used:

1. `users`
2. `organizations`
3. `org_members`
4. `events`
5. `participants`
6. `stands`
7. `resources`
8. `meetings`
9. `leads`
10. `lead_interactions`
11. `chat_rooms`
12. `chat_messages`
13. `notifications`
14. `subscriptions`
15. `favorites`
16. `assistant_sessions`
17. `assistant_messages`
18. `analytics_events`

---

## 13. Event Lifecycle State Machine

```
DRAFT → PENDING_APPROVAL → APPROVED → LIVE → CLOSED
```

| Transition | Required Role | Endpoint |
|------------|---------------|----------|
| DRAFT → PENDING_APPROVAL | ORGANIZER (owner) | `POST /events/{id}/submit` |
| PENDING_APPROVAL → APPROVED | ADMIN | `POST /events/{id}/approve` |
| APPROVED → LIVE | ADMIN or ORGANIZER (owner) | `POST /events/{id}/start` |
| LIVE → CLOSED | ADMIN or ORGANIZER (owner) | `POST /events/{id}/close` |

On approval, a notification is created for the organizer.

---

## 14. Directory Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI entry point
│   ├── core/
│   │   ├── config.py              # Settings (pydantic-settings)
│   │   ├── dependencies.py        # Auth dependencies (get_current_user, require_role, etc.)
│   │   ├── logging.py             # Logging setup
│   │   ├── security.py            # JWT + password hashing (Argon2)
│   │   └── store.py               # Legacy in-memory store
│   ├── db/
│   │   ├── indexes.py             # MongoDB index definitions
│   │   ├── mongo.py               # Motor async MongoDB client
│   │   └── utils.py               # ObjectId stringify helper
│   ├── modules/
│   │   ├── ai_rag/                # RAG assistant (ChromaDB + Ollama)
│   │   │   ├── chunker.py
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   └── vector_store.py
│   │   ├── ai_translation/        # MarianMT translation + langdetect
│   │   │   ├── language_detector.py
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   └── translation_model.py
│   │   ├── analytics/             # Event logging + dashboard metrics
│   │   │   ├── repository.py
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── auth/                  # Login, register, refresh, RBAC
│   │   │   ├── enums.py           # Role enum
│   │   │   ├── router.py
│   │   │   └── schemas.py
│   │   ├── chat/                  # Real-time messaging (WebSocket)
│   │   │   ├── repository.py
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── dev/                   # Dev seed endpoints
│   │   │   └── router.py
│   │   ├── events/                # Event CRUD + lifecycle
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── favorites/             # Bookmark events/stands/orgs
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── leads/                 # Lead capture + CRM
│   │   │   ├── repository.py
│   │   │   ├── router.py
│   │   │   └── schemas.py
│   │   ├── meetings/              # Meeting scheduling
│   │   │   ├── repository.py
│   │   │   ├── router.py
│   │   │   └── schemas.py
│   │   ├── notifications/         # User notifications
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── organizations/         # Organization management
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── participants/          # Event participation (invite/request/approve)
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── recommendations/       # Hybrid content+CF recommendations
│   │   │   ├── embedding_service.py
│   │   │   ├── recommendation_engine.py
│   │   │   ├── router.py
│   │   │   └── schemas.py
│   │   ├── resources/             # File upload + catalog
│   │   │   ├── repository.py
│   │   │   ├── router.py
│   │   │   └── schemas.py
│   │   ├── stands/                # Exhibition stands
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── subscriptions/         # Plan management (Free/Pro)
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── transcripts/           # Whisper STT
│   │   │   ├── router.py
│   │   │   └── whisper_service.py
│   │   └── users/                 # User profile management
│   │       ├── router.py
│   │       ├── schemas.py
│   │       └── service.py
│   └── workers/tasks/             # Background workers (placeholders)
│       ├── embeddings.py
│       ├── recommendations.py
│       └── transcripts.py
├── data/chroma_db/                # ChromaDB persistent storage
├── docs/
├── scripts/seed_data.py           # Database seeding script
├── tests/                         # Integration tests
└── uploads/resources/             # Local file uploads

frontend/
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── layout.tsx             # Root layout (AuthProvider + Navbar + Footer + FloatingAssistant)
│   │   ├── page.tsx               # Landing page
│   │   ├── auth/                  # /auth/login, /auth/register
│   │   ├── events/                # /events, /events/[id], /events/[id]/live, /events/[id]/stands/[standId]
│   │   ├── dashboard/             # /dashboard
│   │   ├── profile/               # /profile
│   │   ├── favorites/             # /favorites
│   │   ├── assistant/             # /assistant
│   │   ├── webinars/              # /webinars
│   │   └── (organizer)/           # /organizer, /organizer/events, /organizer/events/new, /organizer/profile, /organizer/subscription
│   ├── components/                # UI components
│   │   ├── assistant/             # FloatingAssistant
│   │   ├── auth/                  # Auth forms
│   │   ├── cards/                 # Card components
│   │   ├── common/                # Container, SectionTitle
│   │   ├── dashboard/             # Dashboard widgets
│   │   ├── event/                 # Event detail components
│   │   ├── events/                # Events list components
│   │   ├── layout/                # Navbar, Footer
│   │   ├── modals/                # Modal dialogs
│   │   ├── stand/                 # Stand components
│   │   ├── ui/                    # shadcn/ui primitives (Button, Card, etc.)
│   │   └── webinars/              # Webinar components
│   ├── context/AuthContext.tsx     # Auth state management
│   ├── hooks/                     # React hooks
│   ├── lib/                       # HTTP clients, config, auth helpers
│   │   └── api/                   # apiClient, endpoints, typed API functions
│   ├── services/                  # Service layer (auth, events, favorites, assistant, chat, stands)
│   └── types/                     # TypeScript type definitions
└── package.json
```
