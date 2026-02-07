# IVEP Backend API Guide

This guide provides a comprehensive overview of the Intelligent Virtual Exhibition Platform (IVEP) backend routes, how to test them using Postman, and their roles within the platform.

## Base Configuration

- **Base URL**: `http://localhost:8000/api/v1`
- **Authentication**: Bearer Token required for most routes.
  - **Development Bypass**: Use `Authorization: Bearer test-token` to authenticate as a mock visitor (`visitor-456`).

---

## 1. Analytics Module
**Base Path**: `/analytics`

| Route | Method | Description | Role/Usage |
|-------|--------|-------------|------------|
| `/stand/{id}` | GET | Get real-time stand analytics. | Used by Enterprise users to view visitor traffic, resource downloads, and meeting counts for their stand. |
| `/event/{id}` | GET | Get event-level analytics. | Used by Organizers to track overall event performance. |
| `/platform` | GET | Get platform-wide metrics. | Admin-only dashboard for cross-event data. |

### Postman Test Examples
- **Check Stand Analytics**: `GET /analytics/stand/test-stand-123` (No body required)
- **Check Event Analytics**: `GET /analytics/event/test-event-456` (No body required)

---

## 2. Meetings & Scheduling
**Base Path**: `/meetings`

| Route | Method | Description | Role/Usage |
|-------|--------|-------------|------------|
| `/` | POST | Request a new meeting. | Visitors use this on a stand page to book a slot with the enterprise team. |
| `/my-meetings`| GET | List visitor's meetings. | Used in the Visitor Dashboard to view upcoming/requested appointments. |
| `/stand/{id}` | GET | List stand's meetings. | Enterprise users use this to manage, approve, or reject meeting requests. |
| `/{id}` | PATCH | Update meeting status. | Used to Approve/Reject/Cancel meetings. |

### Postman JSON Payloads

#### Create Meeting (`POST /meetings/`)
```json
{
    "stand_id": "test-stand-123",
    "visitor_id": "visitor-456",
    "start_time": "2026-02-06T16:00:00Z",
    "end_time": "2026-02-06T16:30:00Z",
    "purpose": "Product demonstration request"
}
```

#### Update Meeting Status (`PATCH /meetings/{id}`)
```json
{
    "status": "approved",
    "notes": "Confirmed for room A"
}
```

---

## 3. Resource Management
**Base Path**: `/resources`

| Route | Method | Description | Role/Usage |
|-------|--------|-------------|------------|
| `/upload` | POST | Upload a stand resource. | Enterprise users upload PDFs, videos, or brochures for their stand. |
| `/stand/{id}` | GET | Get stand resource catalog. | Visitors browse this list on the stand UI to download materials. |
| `/{id}/track` | GET | Track resource download. | Called automatically when a visitor clicks "Download" to update analytics. |

### Postman Test Examples

#### Resource Upload (`POST /resources/upload`)
- **Body**: Select `form-data`.
- **Fields (must be in form-data)**:
  - `stand_id`: `test-stand-123`
  - `title`: `Company Brochure`
  - `type`: `pdf`
  - `description`: `Optional text description`
  - `file`: (Select a file from your computer)

#### Tracking Download (`GET /resources/{resource_id}/track`)
- No body required. Update analytics on the backend.

---

## 4. Lead Generation
**Base Path**: `/leads`

| Route | Method | Description | Role/Usage |
|-------|--------|-------------|------------|
| `/interactions`| POST | Log a visitor interaction. | Backend tracks every visit, chat, or download to generate leads for exhibitors. |
| `/stand/{id}` | GET | Get leads list for a stand. | Exhibitors view and export high-potential leads with activity scores. |

### Postman JSON Payloads

#### Log Interaction (`POST /leads/interactions`)
```json
{
    "visitor_id": "visitor-456",
    "stand_id": "test-stand-123",
    "interaction_type": "resource_download",
    "metadata": {
        "resource_id": "6985f7fecfe31f74575b3914",
        "device": "mobile"
    }
}
```

---

## 5. AI Recommendations
**Base Path**: `/recommendations`

| Route | Method | Description | Role/Usage |
|-------|--------|-------------|------------|
| `/user/{id}` | GET | Get personalized recs. | Main Landing/Dashboard feature. Suggests events, stands, and resources based on user behavior. |
| `/events/{id}`| GET | Get related events. | Cross-selling events to visitors. |
| `/enterprise/{id}`| GET | Get prospective users. | Helps Enterprise users find high-potential visitors to invite to their stand. |

### Postman Test Examples
- **User Recommendations**: `GET /recommendations/user/visitor-456?limit=5`
- **Related Events**: `GET /recommendations/events/event-789`

---

## 6. AI Assistant (RAG)
**Base Path**: `/assistant`

| Route | Method | Description | Role/Usage |
|-------|--------|-------------|------------|
| `/{scope}/query` | POST | Ask the AI Assistant. | Powers the "Ask anything" chat on stand pages. Retrieves context from stand materials using RAG. |
| `/{scope}/ingest`| POST | Ingest document to scope. | Admin tool to add custom data (URLs or text) to the enterprise/stand knowledge base. |

### Postman JSON Payloads

#### Ask Assistant (`POST /assistant/stand_123/query`)
```json
{
    "query": "What are the main services offered by this exhibitor?",
    "session_id": "session-xyz",
    "stream": true
}
```

#### Ingest Context (`POST /assistant/stand_123/ingest`)
```json
{
    "source_url": "https://example-exhibitor.com/about",
    "content": "Full text of the company description...",
    "metadata": {
        "author": "Marketing Team",
        "category": "Company Profile"
    }
}
```

---

## 7. Chat Module
**Base Path**: `/chat`

| Route | Method | Description | Role/Usage |
|-------|--------|-------------|------------|
| `/rooms` | GET | List user's chat rooms. | Used to populate the chat sidebar with active conversations. |
| `/messages` | POST | Send a chat message. | Core real-time messaging between users. |

### Postman JSON Payloads

#### Send Message (`POST /chat/messages`)
```json
{
    "room_id": "room-678",
    "content": "Hello, I have a question about your pricing.",
    "type": "text"
}
```

---

## Testing with Postman (Quick Start)

1. **Authorization**: Tab -> Type: `Bearer Token` -> Token: `test-token`.
2. **Headers**: Verify `Content-Type: application/json` is active.
3. **URL**: Use the routes above formatted as `http://localhost:8000/api/v1/[module-path]`.
