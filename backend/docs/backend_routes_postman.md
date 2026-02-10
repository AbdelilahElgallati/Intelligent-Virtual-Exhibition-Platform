# IVEP Backend Routes — Postman Test Guide

Base URL: `http://127.0.0.1:8000/api/v1`  
Auth: Bearer Token. For quick testing as Visitor use `test-token`. For role-based actions, login:
- Admin: `admin@ivep.com` / `admin123`
- Organizer: `organizer@ivep.com` / `organizer123`
- Visitor: `visitor@ivep.com` / `visitor123`

## Auth
- POST `/auth/login`

```json
{ "email": "organizer@ivep.com", "password": "organizer123" }
```

- POST `/auth/refresh`

```json
{ "refresh_token": "<token>" }
```

## Organizations
- POST `/organizations/create` (Organizer/Admin)

```json
{ "name": "Acme Corp", "description": "Exhibitor" }
```

- GET `/organizations` (Any authenticated)

## Subscriptions
- POST `/subscriptions/assign` (Admin)

```json
{ "organization_id": "<org_uuid>", "plan": "pro" }
```

- GET `/subscriptions/org/{organization_id}` (Admin/Owner)

## Events
- POST `/events` (Organizer/Admin)

```json
{ "title": "Spring Expo", "description": "Annual showcase" }
```

- GET `/events`
- GET `/events/{event_id}`
- PUT `/events/{event_id}` (Organizer/Admin)

```json
{ "title": "Spring Expo 2026", "description": "Updated" }
```

- DELETE `/events/{event_id}` (Organizer/Admin)
- POST `/events/{event_id}/submit` (Organizer)
- POST `/events/{event_id}/approve` (Admin)
- POST `/events/{event_id}/start` (Organizer/Admin)
- POST `/events/{event_id}/close` (Organizer/Admin)

## Stands
- POST `/events/{event_id}/stands` (Organizer/Admin)

```json
{ "organization_id": "<org_uuid>", "name": "Acme Booth" }
```

- GET `/events/{event_id}/stands`

## Resources
- POST `/resources/upload` (Auth, multipart/form-data)
  - form-data:
    - stand_id: `<stand_uuid>`
    - title: `Brochure`
    - type: `pdf`
    - description: `Acme brochure`
    - file: select a file
- GET `/resources/stand/{stand_id}`
- GET `/resources/{resource_id}/track`

## Meetings
- POST `/meetings` (Visitor, use `test-token`)

```json
{
  "stand_id": "<stand_uuid>",
  "visitor_id": "visitor-456",
  "start_time": "2026-02-11T10:00:00Z",
  "end_time": "2026-02-11T10:30:00Z",
  "purpose": "Demo request"
}
```

- GET `/meetings/my-meetings` (Visitor)
- GET `/meetings/stand/{stand_id}` (Auth)
- PATCH `/meetings/{meeting_id}` (Auth)

```json
{ "status": "approved", "notes": "Confirmed" }
```

## Leads
- POST `/leads/interactions`

```json
{
  "visitor_id": "visitor-456",
  "stand_id": "<stand_uuid>",
  "interaction_type": "resource_download",
  "metadata": { "resource_id": "<resource_id>", "device": "web" }
}
```

- GET `/leads/stand/{stand_id}`
- GET `/leads/export/{stand_id}`

## Analytics
- GET `/analytics/stand/{stand_id}`
- GET `/analytics/event/{event_id}`
- GET `/analytics/platform`

## Chat
- GET `/chat/rooms` (Use `test-token`)
- GET `/chat/rooms/{room_id}/messages`
- WS `/chat/ws/{client_id}?token=<token>`

## Recommendations
- GET `/recommendations/user/{user_id}?limit=5`
- GET `/recommendations/events/{event_id}`
- GET `/recommendations/enterprise/{enterprise_id}`

## Assistant (RAG)
- POST `/assistant/{scope}/query`

```json
{ "query": "What services are offered?", "session_id": "sess-1", "stream": true }
```

- POST `/assistant/{scope}/ingest`

```json
{
  "source_url": "https://example.com/about",
  "content": "Full text ...",
  "metadata": { "author": "Team", "category": "Profile" }
}
```

## Translation
- POST `/translation/detect`

```json
{ "text": "Bonjour" }
```

- POST `/translation/translate`

```json
{ "text": "Bonjour", "target_language": "en" }
```

## Test Tokens
- Use `Authorization: Bearer test-token` for quick Visitor flows
- Use `/auth/login` to get admin/organizer tokens for RBAC endpoints
