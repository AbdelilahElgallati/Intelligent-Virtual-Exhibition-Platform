"""
Integration tests for Event Lifecycle Control & Automation (Week 2).

Tests:
  1. run_lifecycle_tick auto-starts events with state=payment_done and start_date <= now
  2. run_lifecycle_tick auto-closes events with state=live and end_date < now
  3. Tick is idempotent (second call doesn't re-transition)
  4. Tick does NOT affect events where time hasn't come yet
  5. force-start endpoint: success, wrong state (400), non-admin (403)
  6. force-close endpoint: success, wrong state (400), non-admin (403)
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


# ─── Helpers ──────────────────────────────────────────────────────────────────

def admin_login() -> str:
    """Login as admin and return JWT token."""
    r = requests.post(f"{BASE}/auth/login", json={"email": "admin@demo.com", "password": "password123"}, timeout=5)
    if r.status_code != 200:
        skip("admin login", f"status={r.status_code}, credentials may differ")
        return ""
    return r.json().get("access_token", "")


def non_admin_login() -> str:
    """Login as organizer and return JWT token."""
    r = requests.post(
        f"{BASE}/auth/login",
        json={"email": "organizer@demo.com", "password": "password123"},
        timeout=5,
    )
    if r.status_code != 200:
        return ""
    return r.json().get("access_token", "")


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def get_first_event_by_state(token: str, state: str) -> dict | None:
    """Fetch the first event matching the given state."""
    r = requests.get(f"{BASE}/events?state={state}", headers=auth_headers(token), timeout=5)
    if r.status_code != 200:
        return None
    events = r.json().get("events", [])
    return events[0] if events else None


# ─── Scheduler tick unit tests (import and run directly) ──────────────────────

async def run_tick_tests():
    """
    Import and call run_lifecycle_tick directly without a server.
    Requires the backend Python path to be importable.
    """
    print("\n[Scheduler Unit Tests]")

    try:
        # Only works if run from the backend directory
        from app.db.mongo import connect_to_mongo
        from app.workers.lifecycle import run_lifecycle_tick
        from app.db.mongo import get_database
    except ImportError as e:
        skip("scheduler unit tests", f"import error (run from backend dir): {e}")
        return

    try:
        await connect_to_mongo()
    except Exception as e:
        skip("scheduler unit tests", f"DB connection error: {e}")
        return

    db = get_database()
    col = db["events"]

    now = datetime.now(timezone.utc)
    past = now - timedelta(hours=2)
    future = now + timedelta(hours=2)

    # ── Test 1: auto-start ────────────────────────────────────────────────────
    doc_start = {
        "_id": ObjectId(),
        "title": "_test_auto_start",
        "state": "payment_done",
        "start_date": past,       # start_date in past → should auto-start
        "end_date": future,
        "organizer_id": "test",
    }
    await col.insert_one(doc_start)

    result = await run_lifecycle_tick(now=now)
    live_doc = await col.find_one({"_id": doc_start["_id"]})

    if live_doc and live_doc.get("state") == "live":
        ok("auto-start: payment_done + past start_date → live", f"id={doc_start['_id']}")
    else:
        fail("auto-start: payment_done + past start_date → live",
             f"state={live_doc.get('state') if live_doc else 'not found'}")

    # ── Test 2: idempotency ───────────────────────────────────────────────────
    result2 = await run_lifecycle_tick(now=now)
    if doc_start["_id"] not in [ObjectId(x) for x in result2.get("started", [])]:
        ok("idempotency: second tick does not re-start already-live event")
    else:
        fail("idempotency: second tick re-started already-live event")

    # ── Test 3: auto-close ────────────────────────────────────────────────────
    doc_close = {
        "_id": ObjectId(),
        "title": "_test_auto_close",
        "state": "live",
        "start_date": past,
        "end_date": past,          # end_date in past → should auto-close
        "organizer_id": "test",
    }
    await col.insert_one(doc_close)

    result3 = await run_lifecycle_tick(now=now)
    closed_doc = await col.find_one({"_id": doc_close["_id"]})

    if closed_doc and closed_doc.get("state") == "closed":
        ok("auto-close: live + past end_date → closed")
    else:
        fail("auto-close: live + past end_date → closed",
             f"state={closed_doc.get('state') if closed_doc else 'not found'}")

    # ── Test 4: future events not affected ────────────────────────────────────
    doc_future = {
        "_id": ObjectId(),
        "title": "_test_future",
        "state": "payment_done",
        "start_date": future,     # start_date in future — must NOT auto-start
        "end_date": future + timedelta(days=1),
        "organizer_id": "test",
    }
    await col.insert_one(doc_future)

    await run_lifecycle_tick(now=now)
    future_doc = await col.find_one({"_id": doc_future["_id"]})

    if future_doc and future_doc.get("state") == "payment_done":
        ok("future event not prematurely started")
    else:
        fail("future event not prematurely started",
             f"state={future_doc.get('state') if future_doc else 'not found'}")

    # Cleanup
    await col.delete_many({"title": {"$in": ["_test_auto_start", "_test_auto_close", "_test_future"]}})
    print("  (test events cleaned up)")


# ─── API endpoint tests (integration via HTTP) ───────────────────────────────

def run_api_tests():
    print("\n[Force Endpoint API Tests]")

    admin_token = admin_login()
    if not admin_token:
        skip("all API tests", "admin login failed")
        return

    org_token = non_admin_login()

    # ── Force-start tests ─────────────────────────────────────────────────────

    # Find a payment_done event
    pd_event = get_first_event_by_state(admin_token, "payment_done")

    if pd_event:
        event_id = pd_event["id"]

        # 403 for non-admin
        if org_token:
            r = requests.post(f"{BASE}/admin/events/{event_id}/force-start", headers=auth_headers(org_token), timeout=5)
            if r.status_code == 403:
                ok("force-start: non-admin returns 403")
            else:
                fail("force-start: non-admin returns 403", f"got {r.status_code}")

        # Success for admin
        r = requests.post(f"{BASE}/admin/events/{event_id}/force-start", headers=auth_headers(admin_token), timeout=5)
        if r.status_code == 200 and r.json().get("state") == "live":
            ok("force-start: admin + payment_done → live", f"event={event_id}")
        else:
            fail("force-start: admin + payment_done → live", f"status={r.status_code} body={r.text[:200]}")

        # Second call — wrong state (now live)
        r2 = requests.post(f"{BASE}/admin/events/{event_id}/force-start", headers=auth_headers(admin_token), timeout=5)
        if r2.status_code == 400:
            ok("force-start: 400 when already live")
        else:
            fail("force-start: 400 when already live", f"got {r2.status_code}")

        # ── Force-close the same event ─────────────────────────────────────────

        # 403 for non-admin
        if org_token:
            r = requests.post(f"{BASE}/admin/events/{event_id}/force-close", headers=auth_headers(org_token), timeout=5)
            if r.status_code == 403:
                ok("force-close: non-admin returns 403")
            else:
                fail("force-close: non-admin returns 403", f"got {r.status_code}")

        r = requests.post(f"{BASE}/admin/events/{event_id}/force-close", headers=auth_headers(admin_token), timeout=5)
        if r.status_code == 200 and r.json().get("state") == "closed":
            ok("force-close: admin + live → closed")
        else:
            fail("force-close: admin + live → closed", f"status={r.status_code} body={r.text[:200]}")

        # Second call — should return 400
        r2 = requests.post(f"{BASE}/admin/events/{event_id}/force-close", headers=auth_headers(admin_token), timeout=5)
        if r2.status_code == 400:
            ok("force-close: 400 when already closed")
        else:
            fail("force-close: 400 when already closed", f"got {r2.status_code}")

    else:
        skip("force-start / force-close", "no payment_done event found — seed data needed")

    # ── force-start on wrong-state event ──────────────────────────────────────
    pending_event = get_first_event_by_state(admin_token, "pending_approval")
    if pending_event:
        r = requests.post(
            f"{BASE}/admin/events/{pending_event['id']}/force-start",
            headers=auth_headers(admin_token),
            timeout=5,
        )
        if r.status_code == 400:
            ok("force-start: 400 on wrong state (pending_approval)")
        else:
            fail("force-start: 400 on wrong state", f"got {r.status_code}")
    else:
        skip("force-start wrong state test", "no pending_approval event found")


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("Lifecycle & Force Endpoint Tests")
    print("=" * 60)

    # Run scheduler unit tests (requires monkeypatching DB)
    asyncio.run(run_tick_tests())

    # Run HTTP API tests
    run_api_tests()

    print("\n" + "=" * 60)
    print(f"Results: {GREEN}{passed} passed{RESET}  |  {RED}{failed} failed{RESET}")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)
