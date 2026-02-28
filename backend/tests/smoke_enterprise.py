"""Quick endpoint smoke test for enterprise requests."""
import asyncio
import httpx

BASE = "http://127.0.0.1:8000/api/v1"

async def main():
    async with httpx.AsyncClient(timeout=10) as c:
        # Admin login
        r = await c.post(f"{BASE}/auth/login", json={"email": "admin@demo.com", "password": "Password123!"})
        print("Admin login:", r.status_code)
        if r.status_code != 200:
            print("  Error:", r.text[:300])
            return
        
        token = r.json()["access_token"]
        hdrs = {"Authorization": f"Bearer {token}"}

        # Get events
        r2 = await c.get(f"{BASE}/events/", headers=hdrs)
        events = r2.json().get("events", [])
        if not events:
            print("No events found")
            return
        event_id = events[0]["id"]
        print(f"Using event: {event_id}")

        # TEST 1: NEW admin enterprise-requests endpoint
        r3 = await c.get(f"{BASE}/admin/events/{event_id}/enterprise-requests", headers=hdrs)
        print(f"\nTEST 1 - GET /admin/events/{{id}}/enterprise-requests")
        print(f"  Status: {r3.status_code} (expected 200)")
        if r3.status_code == 200:
            body = r3.json()
            print(f"  Keys: {list(body.keys())}")
            print(f"  total={body.get('total')}, items={len(body.get('items', []))}")
        else:
            print(f"  Body: {r3.text[:300]}")

        # TEST 2: Unauthenticated returns 401/403
        r4 = await c.get(f"{BASE}/admin/events/{event_id}/enterprise-requests")
        print(f"\nTEST 2 - Unauthenticated access")
        print(f"  Status: {r4.status_code} (expected 401 or 403)")

        # TEST 3: Status filter
        r5 = await c.get(
            f"{BASE}/admin/events/{event_id}/enterprise-requests?status=approved&search=tech",
            headers=hdrs
        )
        print(f"\nTEST 3 - Search + status filter")
        print(f"  Status: {r5.status_code} (expected 200)")
        if r5.status_code == 200:
            body5 = r5.json()
            print(f"  total={body5.get('total')}, skip={body5.get('skip')}, limit={body5.get('limit')}")

        print("\nAll endpoint smoke tests done!")

asyncio.run(main())
