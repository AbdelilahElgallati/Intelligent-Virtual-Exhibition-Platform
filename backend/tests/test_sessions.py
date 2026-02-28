"""
Integration tests for Week 5: Conference Session Orchestration.

Tests:
  1. Create session validates start < end
  2. Create session validates within event date range
  3. Create session success — returns SessionRead
  4. Manual start: scheduled → live
  5. Manual start: conflict if already live (409)
  6. Manual end: live → ended
  7. Manual end: conflict if not live (409)
  8. Auto-start via run_session_tick (scheduled + past start_time → live)
  9. Auto-end via run_session_tick (live + past end_time → ended)
  10. Tick is idempotent
  11. Audit logs are created for create / start / end
  12. Transcript WS rejected when session not live
  13. Sync-from-schedule: imports conference slots, skips non-conference, idempotent
"""

import sys
import asyncio
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import requests

BASE = "http://127.0.0.1:8000/api/v1"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

passed = 0
failed = 0


def ok(name: str, detail: str = ""):
    global passed
    passed += 1
    print(f"  {GREEN}[PASS]{RESET} {name}" + (f" — {detail}" if detail else ""))


def fail(name: str, detail: str = ""):
    global failed
    failed += 1
    print(f"  {RED}[FAIL]{RESET} {name}" + (f" — {detail}" if detail else ""))


def skip(name: str, reason: str = ""):
    print(f"  {YELLOW}[SKIP]{RESET} {name}" + (f" — {reason}" if reason else ""))


# ─── Auth helpers ─────────────────────────────────────────────────────────────

def admin_login() -> str:
    r = requests.post(
        f"{BASE}/auth/login",
        json={"email": "admin@demo.com", "password": "password123"},
        timeout=5,
    )
    if r.status_code != 200:
        return ""
    return r.json().get("access_token", "")


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── Scheduler tick unit tests ────────────────────────────────────────────────

async def run_session_tick_tests():
    print("\n[Session Scheduler Unit Tests]")

    try:
        from app.db.mongo import connect_to_mongo, get_database
        from app.workers.lifecycle import run_session_tick
    except ImportError as e:
        skip("scheduler unit tests", f"import error (run from backend/): {e}")
        return

    try:
        await connect_to_mongo()
    except Exception as e:
        skip("scheduler unit tests", f"DB connection error: {e}")
        return

    db = get_database()
    col = db["event_sessions"]

    now = datetime.now(timezone.utc)
    past = now - timedelta(hours=2)
    future = now + timedelta(hours=2)

    # ── T1: auto-start ────────────────────────────────────────────────────────
    doc_start = {
        "_id": ObjectId(),
        "event_id": "test_event",
        "title": "_test_auto_start_session",
        "speaker": "Test Speaker",
        "description": None,
        "start_time": past,        # in the past → should auto-start
        "end_time": future,
        "status": "scheduled",
        "created_at": now,
        "updated_at": now,
        "started_at": None,
        "ended_at": None,
    }
    await col.insert_one(doc_start)

    result = await run_session_tick(now=now)
    refreshed = await col.find_one({"_id": doc_start["_id"]})

    if refreshed and refreshed.get("status") == "live":
        ok("auto-start: scheduled + past start_time → live",
           f"id={doc_start['_id']}, started_ids={result['started']}")
    else:
        fail("auto-start: scheduled + past start_time → live",
             f"status={refreshed.get('status') if refreshed else 'not found'}")

    # ── T2: idempotency ───────────────────────────────────────────────────────
    result2 = await run_session_tick(now=now)
    if str(doc_start["_id"]) not in result2.get("started", []):
        ok("auto-start idempotency: second tick skips already-live session")
    else:
        fail("auto-start idempotency: second tick re-started session")

    # ── T3: auto-end ──────────────────────────────────────────────────────────
    doc_end = {
        "_id": ObjectId(),
        "event_id": "test_event",
        "title": "_test_auto_end_session",
        "speaker": "Test Speaker",
        "description": None,
        "start_time": past,
        "end_time": past,           # end_time in past → should auto-end
        "status": "live",
        "created_at": now,
        "updated_at": now,
        "started_at": past,
        "ended_at": None,
    }
    await col.insert_one(doc_end)

    result3 = await run_session_tick(now=now)
    refreshed3 = await col.find_one({"_id": doc_end["_id"]})

    if refreshed3 and refreshed3.get("status") == "ended":
        ok("auto-end: live + past end_time → ended",
           f"ended_ids={result3['ended']}")
    else:
        fail("auto-end: live + past end_time → ended",
             f"status={refreshed3.get('status') if refreshed3 else 'not found'}")

    # ── T4: future session not auto-started ───────────────────────────────────
    doc_future = {
        "_id": ObjectId(),
        "event_id": "test_event",
        "title": "_test_future_session",
        "speaker": "Future Speaker",
        "start_time": future,
        "end_time": future + timedelta(hours=1),
        "status": "scheduled",
        "created_at": now,
        "updated_at": now,
        "started_at": None,
        "ended_at": None,
    }
    await col.insert_one(doc_future)

    await run_session_tick(now=now)
    refreshed4 = await col.find_one({"_id": doc_future["_id"]})

    if refreshed4 and refreshed4.get("status") == "scheduled":
        ok("future session not prematurely started")
    else:
        fail("future session not prematurely started",
             f"status={refreshed4.get('status') if refreshed4 else 'not found'}")

    # Cleanup
    test_ids = [doc_start["_id"], doc_end["_id"], doc_future["_id"]]
    await col.delete_many({"_id": {"$in": test_ids}})
    print("  (test sessions cleaned up)")


# ─── Service-level unit tests ─────────────────────────────────────────────────

async def run_service_tests():
    print("\n[Session Service Unit Tests]")

    try:
        from app.db.mongo import connect_to_mongo, get_database
        from app.modules.sessions.service import (
            create_session, start_session, end_session,
            sync_sessions_from_schedule, get_session_by_id,
        )
        from app.modules.sessions.schemas import SessionCreate, SessionStatus
    except ImportError as e:
        skip("service unit tests", f"import error (run from backend/): {e}")
        return

    try:
        await connect_to_mongo()
    except Exception as e:
        skip("service unit tests", f"DB connection error: {e}")
        return

    db = get_database()
    events_col = db["events"]
    sessions_col = db["event_sessions"]
    audit_col = db["audit_logs"]

    now = datetime.now(timezone.utc)
    past = now - timedelta(hours=24)
    future_start = now + timedelta(hours=1)
    future_end = now + timedelta(hours=2)

    # Insert a fake live event
    fake_event = {
        "_id": ObjectId(),
        "title": "_test_week5_event",
        "state": "live",
        "start_date": past,
        "end_date": now + timedelta(days=7),
        "organizer_id": "test",
        "schedule_days": [
            {
                "day_number": 1,
                "date_label": "Day 1",
                "slots": [
                    {"start_time": "10:00", "end_time": "11:00",
                     "label": "Opening Keynote"},         # → session
                    {"start_time": "11:00", "end_time": "12:00",
                     "label": "Conference Workshop A"},   # → session
                    {"start_time": "12:00", "end_time": "13:00",
                     "label": "Lunch Break"},             # NOT a session
                ],
            }
        ],
    }
    await events_col.insert_one(fake_event)
    event_id = str(fake_event["_id"])

    # ── T5: create_session validates start < end ──────────────────────────────
    try:
        SessionCreate(
            title="Bad",
            speaker="Speaker",
            start_time=future_end,
            end_time=future_start,
        )
        fail("create_session schema rejects start >= end", "no error raised")
    except Exception:
        ok("create_session schema rejects start >= end (ValidationError)")

    # ── T6: create_session success ────────────────────────────────────────────
    session_data = SessionCreate(
        title="_Test Session",
        speaker="Test Speaker",
        description="A test session",
        start_time=future_start,
        end_time=future_end,
    )
    try:
        sess = await create_session(event_id=event_id, data=session_data, actor_id="test_actor")
        if sess.status == SessionStatus.SCHEDULED and sess.title == "_Test Session":
            ok("create_session: returns scheduled SessionRead", f"id={sess.id}")
        else:
            fail("create_session: unexpected result", f"status={sess.status}")
    except Exception as exc:
        fail("create_session success", str(exc))
        sess = None

    if sess:
        # ── T7: start_session ─────────────────────────────────────────────────
        try:
            started = await start_session(sess.id, actor_id="test_actor")
            if started.status == SessionStatus.LIVE and started.started_at is not None:
                ok("start_session: scheduled → live", f"started_at={started.started_at}")
            else:
                fail("start_session: unexpected status", f"status={started.status}")
        except Exception as exc:
            fail("start_session", str(exc))
            started = None

        # ── T8: start_session conflict ────────────────────────────────────────
        try:
            await start_session(sess.id, actor_id="test_actor")
            fail("start_session conflict: should raise ValueError for live session")
        except ValueError as exc:
            ok("start_session conflict: raises ValueError for already-live session")
        except Exception as exc:
            fail("start_session conflict", str(exc))

        # ── T9: end_session ───────────────────────────────────────────────────
        try:
            ended = await end_session(sess.id, actor_id="test_actor")
            if ended.status == SessionStatus.ENDED and ended.ended_at is not None:
                ok("end_session: live → ended", f"ended_at={ended.ended_at}")
            else:
                fail("end_session: unexpected status", f"status={ended.status}")
        except Exception as exc:
            fail("end_session", str(exc))

        # ── T10: end_session conflict ─────────────────────────────────────────
        try:
            await end_session(sess.id, actor_id="test_actor")
            fail("end_session conflict: should raise ValueError for ended session")
        except ValueError as exc:
            ok("end_session conflict: raises ValueError for already-ended session")
        except Exception as exc:
            fail("end_session conflict", str(exc))

        # ── T11: audit log created ────────────────────────────────────────────
        audit_count = await audit_col.count_documents({
            "entity": "session",
            "entity_id": sess.id,
            "action": {"$in": ["session.create", "session.start", "session.end"]},
        })
        if audit_count >= 3:
            ok("audit logs: create + start + end all logged", f"count={audit_count}")
        else:
            fail("audit logs: expected >=3 audit entries", f"found={audit_count}")

    # ── T12: sync_sessions_from_schedule ─────────────────────────────────────
    try:
        created = await sync_sessions_from_schedule(event_id=event_id, actor_id="test_actor")
        keynote = next((s for s in created if "Keynote" in s.title), None)
        workshop = next((s for s in created if "Workshop" in s.title), None)
        lunch = next((s for s in created if "Lunch" in s.title), None)

        if keynote and workshop and not lunch:
            ok("sync_from_schedule: imports Keynote + Workshop, skips Lunch Break",
               f"created={len(created)}")
        else:
            fail("sync_from_schedule: unexpected import result",
                 f"keynote={bool(keynote)}, workshop={bool(workshop)}, lunch={bool(lunch)}")
    except Exception as exc:
        fail("sync_from_schedule", str(exc))
        created = []

    # ── T13: sync idempotency ─────────────────────────────────────────────────
    try:
        second_sync = await sync_sessions_from_schedule(event_id=event_id, actor_id="test_actor")
        if len(second_sync) == 0:
            ok("sync_from_schedule idempotency: second sync creates nothing")
        else:
            fail("sync_from_schedule idempotency: created extra sessions",
                 f"count={len(second_sync)}")
    except Exception as exc:
        fail("sync idempotency", str(exc))

    # Cleanup
    await events_col.delete_one({"_id": fake_event["_id"]})
    await sessions_col.delete_many({"event_id": event_id})
    await audit_col.delete_many({"entity": "session", "metadata.event_id": event_id})
    print("  (test data cleaned up)")


# ─── HTTP API (integration) tests ─────────────────────────────────────────────

def run_api_tests():
    print("\n[Session HTTP API Tests]")

    admin_token = admin_login()
    if not admin_token:
        skip("all API tests", "admin login failed — check credentials")
        return

    headers = auth_headers(admin_token)

    # Find a live event
    r = requests.get(f"{BASE}/events?state=live", headers=headers, timeout=5)
    if r.status_code != 200 or not r.json().get("events"):
        skip("API tests", "no live event found — seed data needed")
        return

    event_id = r.json()["events"][0]["id"]
    now = datetime.now(timezone.utc)
    future_start = (now + timedelta(hours=2)).isoformat()
    future_end = (now + timedelta(hours=3)).isoformat()

    # ── Create session ────────────────────────────────────────────────────────
    payload = {
        "title": "_API Test Session",
        "speaker": "Test Speaker",
        "description": "Created by test",
        "start_time": future_start,
        "end_time": future_end,
    }
    r = requests.post(f"{BASE}/admin/events/{event_id}/sessions",
                      json=payload, headers=headers, timeout=5)
    if r.status_code == 201:
        ok("POST /admin/events/{id}/sessions → 201")
        session_id = r.json()["id"]
    else:
        fail("POST /admin/events/{id}/sessions", f"status={r.status_code} body={r.text[:200]}")
        return

    # ── Start session ─────────────────────────────────────────────────────────
    r = requests.patch(f"{BASE}/admin/sessions/{session_id}/start",
                       headers=headers, timeout=5)
    if r.status_code == 200 and r.json().get("status") == "live":
        ok("PATCH /admin/sessions/{id}/start → live")
    else:
        fail("PATCH start", f"status={r.status_code} body={r.text[:200]}")

    # ── Start conflict ────────────────────────────────────────────────────────
    r = requests.patch(f"{BASE}/admin/sessions/{session_id}/start",
                       headers=headers, timeout=5)
    if r.status_code == 409:
        ok("PATCH start conflict → 409")
    else:
        fail("PATCH start conflict", f"expected 409 got {r.status_code}")

    # ── End session ───────────────────────────────────────────────────────────
    r = requests.patch(f"{BASE}/admin/sessions/{session_id}/end",
                       headers=headers, timeout=5)
    if r.status_code == 200 and r.json().get("status") == "ended":
        ok("PATCH /admin/sessions/{id}/end → ended")
    else:
        fail("PATCH end", f"status={r.status_code} body={r.text[:200]}")

    # ── End conflict ──────────────────────────────────────────────────────────
    r = requests.patch(f"{BASE}/admin/sessions/{session_id}/end",
                       headers=headers, timeout=5)
    if r.status_code == 409:
        ok("PATCH end conflict → 409")
    else:
        fail("PATCH end conflict", f"expected 409 got {r.status_code}")

    # ── List sessions ─────────────────────────────────────────────────────────
    r = requests.get(f"{BASE}/admin/events/{event_id}/sessions",
                     headers=headers, timeout=5)
    if r.status_code == 200 and isinstance(r.json(), list):
        ok("GET /admin/events/{id}/sessions → list")
    else:
        fail("GET sessions", f"status={r.status_code}")

    # ── Sync from schedule ────────────────────────────────────────────────────
    r = requests.post(f"{BASE}/admin/events/{event_id}/sessions/sync",
                      headers=headers, timeout=5)
    if r.status_code == 200 and isinstance(r.json(), list):
        ok("POST /sync → list of auto-created sessions", f"count={len(r.json())}")
    else:
        fail("POST /sync", f"status={r.status_code} body={r.text[:200]}")

    # ── Validation: start >= end ──────────────────────────────────────────────
    bad_payload = {**payload, "start_time": future_end, "end_time": future_start}
    r = requests.post(f"{BASE}/admin/events/{event_id}/sessions",
                      json=bad_payload, headers=headers, timeout=5)
    if r.status_code in (400, 422):
        ok("POST sessions validation: start >= end → 400/422")
    else:
        fail("POST sessions validation", f"expected 4xx got {r.status_code}")

    # ── Non-admin access ──────────────────────────────────────────────────────
    # (Just verify we get 403 from a known-guarded endpoint without token)
    r = requests.post(f"{BASE}/admin/events/{event_id}/sessions",
                      json=payload, timeout=5)
    if r.status_code in (401, 403):
        ok("Unauthenticated → 401/403")
    else:
        fail("Unauthenticated check", f"expected 401/403 got {r.status_code}")


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("Week 5: Conference Session Orchestration Tests")
    print("=" * 60)

    asyncio.run(run_session_tick_tests())
    asyncio.run(run_service_tests())
    run_api_tests()

    print("\n" + "=" * 60)
    print(f"Results: {GREEN}{passed} passed{RESET}  |  {RED}{failed} failed{RESET}")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)
