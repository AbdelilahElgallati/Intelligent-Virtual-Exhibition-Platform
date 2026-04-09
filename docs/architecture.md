# Architecture Notes

## API Endpoints (key ones)
- `POST /api/v1/auth/login` — returns access + refresh tokens
- `WS   /api/v1/chat/ws/chat/{room_id}?token=...` — real-time chat
- `POST /api/v1/meetings/request` — visitor sends meeting request
- `PUT  /api/v1/meetings/{id}/status` — enterprise approves/rejects
- `POST /api/v1/enterprise/events/{slug}/stand/resources` — upload PDF (max 10MB)
- `POST /api/v1/events/{slug}/upload-payment-proof` — organizer upload

## Known Patterns
- All API calls use Authorization: Bearer <token> header
- Errors follow format: { "detail": "error message" }
- Pagination: ?page=1&limit=20
- Date format: ISO 8601 UTC (e.g. 2025-03-31T00:00:00Z)

## Database Key Tables
- users (id, email, role, created_at)
- events (id, slug, title, start_date, end_date, status)
- meetings (id, sender_id, receiver_id, event_id, status, scheduled_at)
- notifications (id, user_id, type, message, read, created_at)
- stands (id, enterprise_id, event_id, resources[])
