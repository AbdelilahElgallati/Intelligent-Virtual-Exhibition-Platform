import asyncio
import httpx
import json

BASE_URL = "http://localhost:8000"

async def verify():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Login
        try:
            login_res = await client.post(f"{BASE_URL}/auth/login", data={"username": "enterprise1@demo.com", "password": "password123"})
            login_res.raise_for_status()
            token = login_res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Get events
            events_res = await client.get(f"{BASE_URL}/enterprise/events", headers=headers)
            events = events_res.json()
            if not events:
                print("No events found for enterprise1")
                return
                
            event_id = events[0]["_id"]
            print(f"Checking event: {event_id}")
            
            # 2. Check participants/enterprises
            parts_res = await client.get(f"{BASE_URL}/participants/event/{event_id}/enterprises", headers=headers)
            participants = parts_res.json()
            print(f"Found {len(participants)} enterprise participants")
            for p in participants[:3]:
                print(f"Partner: {p.get('organization_name')}, Stand ID: {p.get('stand_id')}")
                
            # 3. Check meetings
            # Need a stand_id for enterprise1
            stand_res = await client.get(f"{BASE_URL}/enterprise/events/{event_id}/stand", headers=headers)
            stand = stand_res.json()
            stand_id = stand["_id"]
            
            meetings_res = await client.get(f"{BASE_URL}/meetings/stand/{stand_id}", headers=headers)
            meetings = meetings_res.json()
            print(f"Found {len(meetings)} meetings for stand {stand_id}")
            for m in meetings:
                print(f"Meeting from: {m.get('requester_name')} ({m.get('requester_role')}) in {m.get('requester_org_name') or 'N/A'}")
        except Exception as e:
            import traceback
            print(f"Verification failed: {e}")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify())
