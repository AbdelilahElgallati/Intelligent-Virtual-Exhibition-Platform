"""
Synchronous endpoint verification for enterprise requests.
Uses requests (sync) to avoid Windows asyncio event loop issues.
"""
import sys
import requests

BASE = "http://127.0.0.1:8000/api/v1"
GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"
pass_count = 0
fail_count = 0


def check(label, condition, info=""):
    global pass_count, fail_count
    if condition:
        pass_count += 1
        print(f"[{GREEN}PASS{RESET}] {label}" + (f" — {info}" if info else ""))
    else:
        fail_count += 1
        print(f"[{RED}FAIL{RESET}] {label}" + (f" — {info}" if info else ""))


def main():
    print(f"\nEnterprise Requests Endpoint Smoke Test → {BASE}\n" + "=" * 55)

    # — Admin login ——————————————————————————————————————
    r = requests.post(f"{BASE}/auth/login", json={"email": "admin@demo.com", "password": "Password123!"}, timeout=8)
    check("Admin login", r.status_code == 200, f"status={r.status_code}")
    if r.status_code != 200:
        print(r.text[:300])
        sys.exit(1)
    admin_token = r.json()["access_token"]
    ahdr = {"Authorization": f"Bearer {admin_token}"}

    # — Get event id ——————————————————————————————————
    r2 = requests.get(f"{BASE}/events/", headers=ahdr, timeout=8)
    check("List events", r2.status_code == 200, f"status={r2.status_code}")
    events = r2.json().get("events", [])
    if not events:
        print("No events — cannot continue")
        sys.exit(1)
    event_id = events[0]["id"]
    print(f"  Using event_id={event_id}")

    # — TEST 1: New admin endpoint returns 200 ————————————
    r3 = requests.get(
        f"{BASE}/admin/events/{event_id}/enterprise-requests",
        headers=ahdr, timeout=8
    )
    check("GET /admin/events/{id}/enterprise-requests", r3.status_code == 200, f"status={r3.status_code}")
    if r3.status_code == 200:
        body = r3.json()
        check("Response has items/total/skip/limit keys",
              all(k in body for k in ("items", "total", "skip", "limit")),
              f"keys={list(body.keys())}")
        print(f"  total={body.get('total')}, items={len(body.get('items', []))}")

    # — TEST 2: Unauthenticated returns 401/403 ———————————
    r4 = requests.get(f"{BASE}/admin/events/{event_id}/enterprise-requests", timeout=8)
    check("Unauthenticated → 401 or 403", r4.status_code in (401, 403), f"status={r4.status_code}")

    # — TEST 3: Status filter param accepted ——————————————
    r5 = requests.get(
        f"{BASE}/admin/events/{event_id}/enterprise-requests?status=approved",
        headers=ahdr, timeout=8
    )
    check("Status filter (approved) returns 200", r5.status_code == 200, f"status={r5.status_code}")

    # — TEST 4: Search filter param accepted ——————————————
    r6 = requests.get(
        f"{BASE}/admin/events/{event_id}/enterprise-requests?search=nonexistentquery_xyz",
        headers=ahdr, timeout=8
    )
    check("Search filter returns 200", r6.status_code == 200, f"status={r6.status_code}")
    if r6.status_code == 200:
        check("Search filter with no matches returns total=0", r6.json().get("total") == 0,
              f"total={r6.json().get('total')}")

    # — TEST 5: Participant reject endpoint accepts body ———
    # Create a test request-to-join via enterprise login (if seed user exists)
    ent_r = requests.post(f"{BASE}/auth/login",
                          json={"email": "enterprise1@demo.com", "password": "password123"}, timeout=8)
    if ent_r.status_code == 200:
        ent_token = ent_r.json()["access_token"]
        ehdr = {"Authorization": f"Bearer {ent_token}"}

        # Request to join
        rj = requests.post(f"{BASE}/events/{event_id}/participants/request", headers=ehdr, timeout=8)
        if rj.status_code in (200, 201):
            participant_id = rj.json().get("id")
            check("Enterprise user request to join", True, f"participant_id={participant_id}")

            # Reject with reason
            rrej = requests.post(
                f"{BASE}/events/{event_id}/participants/{participant_id}/reject",
                json={"reason": "Smoke test rejection"},
                headers=ahdr, timeout=8
            )
            check("Reject participant (with reason body)", rrej.status_code == 200, f"status={rrej.status_code}")
            if rrej.status_code == 200:
                rbody = rrej.json()
                check("Reject sets status=rejected", rbody.get("status") == "rejected",
                      f"status={rbody.get('status')}")
                check("Reject stores rejection_reason",
                      rbody.get("rejection_reason") == "Smoke test rejection",
                      f"reason={rbody.get('rejection_reason')!r}")
        elif rj.status_code == 400 and "already" in rj.text.lower():
            print(f"  [INFO] Enterprise user already has a participation record — rejection test skipped")
    else:
        print(f"  [SKIP] enterprise1@demo.com not found (status={ent_r.status_code}) — seed-data needed")

    print(f"\n{'='*55}")
    print(f"Results: {GREEN}{pass_count} passed{RESET}  |  {RED}{fail_count} failed{RESET}")
    sys.exit(1 if fail_count > 0 else 0)


if __name__ == "__main__":
    main()
