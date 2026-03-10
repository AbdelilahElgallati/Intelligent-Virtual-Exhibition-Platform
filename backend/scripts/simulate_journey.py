import asyncio
import httpx
import websockets
import json
import uuid
import time
import traceback
from typing import Dict, Any

API_URL = "http://localhost:8000/api/v1"
WS_URL = "ws://localhost:8000/api/v1"

# ----- Helper Functions -----

def print_step(msg: str):
    print(f"\n{'='*50}")
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")
    print(f"{'='*50}")

def print_sub(msg: str):
    print(f"  -> {msg}")

def print_err(msg: str):
    print(f"\n[ERROR] {msg}")

class APIClient:
    def __init__(self, email: str, role: str):
        self.email = email
        self.role = role
        self.password = "password123!"
        self.token = None
        self.user_data = None
        self.client = httpx.AsyncClient(base_url=API_URL, timeout=30.0)

    def set_token(self, token: str):
        self.token = token
        self.client.headers.update({"Authorization": f"Bearer {token}"})

    async def post(self, endpoint: str, json_data: dict = None, raise_for_status: bool = True):
        url = self.client.build_request("POST", endpoint).url
        print(f"DEBUG: POST {url}")
        resp = await self.client.post(endpoint, json=json_data)
        if raise_for_status:
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                print_err(f"POST {endpoint} failed: {e.response.text}")
                raise e
        return resp.json()

    async def patch(self, endpoint: str, json_data: dict = None, raise_for_status: bool = True):
        url = self.client.build_request("PATCH", endpoint).url
        print(f"DEBUG: PATCH {url}")
        resp = await self.client.patch(endpoint, json=json_data)
        if raise_for_status:
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                print_err(f"PATCH {endpoint} failed: {e.response.text}")
                raise e
        return resp.json()

    async def get(self, endpoint: str, params: dict = None):
        url = self.client.build_request("GET", endpoint).url
        print(f"DEBUG: GET {url}")
        resp = await self.client.get(endpoint, params=params)
        resp.raise_for_status()
        return resp.json()

    async def patch(self, endpoint: str, json_data: dict = None):
        resp = await self.client.patch(endpoint, json=json_data)
        resp.raise_for_status()
        return resp.json()
    
    async def close(self):
        await self.client.aclose()


async def register_user(client: APIClient, extra_data: dict = None):
    data = {
        "email": client.email,
        "password": client.password,
        "username": client.email.split("@")[0],
        "full_name": client.email.split("@")[0].capitalize(),
        "role": client.role,
    }
    if extra_data:
        data.update(extra_data)

    print_sub(f"Registering {client.role}: {client.email}")
    resp = await client.client.post("/auth/register", json=data)
    
    # 400 Email already registered is fine, we just login later
    if resp.status_code == 400 and "Email already registered" in resp.text:
        print_sub(f"Email already registered: {client.email}, ignoring.")
    else:
        resp.raise_for_status()
        
    return resp

async def login_user(client: APIClient):
    print_sub(f"Logging in {client.role}: {client.email}")
    data = {
        "email": client.email,
        "password": client.password
    }
    resp = await client.post("/auth/login", json_data=data)
    client.set_token(resp["access_token"])
    client.user_data = resp["user"]
    return resp

# ----- Main Simulation -----

async def main():
    try:
        print_step("STARTING SIMULATION JOURNEY")

        # 1. Setup Clients
        suffix = str(uuid.uuid4())[:8]
        admin = APIClient("admin@demo.com", "admin") # Assumes admin exists
        admin.password = "Password123!"
        visitor = APIClient(f"visitor_{suffix}@demo.com", "visitor")
        organizer = APIClient(f"org_{suffix}@demo.com", "organizer")
        ent_a = APIClient(f"entA_{suffix}@demo.com", "enterprise")
        ent_b = APIClient(f"entB_{suffix}@demo.com", "enterprise")

        # 2. Register new users
        print_step("1. Registration")
        await register_user(visitor)
        await register_user(organizer, {
            "org_name": "Demo Org Events",
            "org_type": "Agency",
            "org_country": "USA",
            "org_city": "NY"
        })
        await register_user(ent_a, {
            "company_name": "Tech Corp A",
            "description": "Tech solutions A",
            "industry": "IT"
        })
        await register_user(ent_b, {
            "company_name": "Soft Inc B",
            "description": "Software solutions B",
            "industry": "Software"
        })

        # 3. Admin Login & Approvals
        print_step("2. Admin Approvals")
        await login_user(admin)
        
        # We need to find the user IDs to approve
        org_reqs = await admin.get("/admin/organizer-registrations")
        org_user_id = next((u["_id"] for u in org_reqs["registrations"] if u["email"] == organizer.email), None)
        if org_user_id:
            print_sub(f"Approving Organizer {org_user_id}")
            await admin.post(f"/admin/organizer-registrations/{org_user_id}/approve")
        
        ent_reqs = await admin.get("/admin/enterprise-registrations")
        ent_a_id = next((u["_id"] for u in ent_reqs["registrations"] if u["email"] == ent_a.email), None)
        ent_b_id = next((u["_id"] for u in ent_reqs["registrations"] if u["email"] == ent_b.email), None)
        
        if ent_a_id:
            print_sub(f"Approving Enterprise A {ent_a_id}")
            await admin.post(f"/admin/enterprise-registrations/{ent_a_id}/approve")
        if ent_b_id:
            print_sub(f"Approving Enterprise B {ent_b_id}")
            await admin.post(f"/admin/enterprise-registrations/{ent_b_id}/approve")


        # 4. Login everyone else
        print_step("3. Client Login")
        await login_user(visitor)
        await login_user(organizer)
        await login_user(ent_a)
        await login_user(ent_b)

        # 5. Create Event
        print_step("4. Event Creation")
        event_data = {
            "title": f"Global Tech Summit {suffix}",
            "description": "A major tech event",
            "start_date": "2026-10-01T10:00:00Z",
            "end_date": "2026-10-05T18:00:00Z",
            "location": "Virtual",
            "is_paid": True,
            "ticket_price": 50.0,
            "category": "Technology",
            "tags": ["tech", "ai", "virtual"],
            "num_enterprises": 10,
            "event_timeline": "Day 1: Keynote\nDay 2: Panels",
            "extended_details": "This is a detailed description of the tech summit with a lot of information.",
            "stand_price": 200.0
        }
        event = await organizer.post("/events/", json_data=event_data)
        event_id = event["id"]
        print_sub(f"Event created with ID: {event_id} (Status: {event['state']})")

        # 6. Event Approval & Payment
        print_step("5. Event Approval & Payment")
        print_sub("Admin approving event...")
        await admin.post(f"/events/{event_id}/approve", {"payment_amount": 500.0})
        
        print_sub("Organizer submitting proof...")
        await organizer.post(f"/events/{event_id}/submit-proof?proof_url=http://fake.url/receipt.pdf")
        
        print_sub("Admin confirming payment...")
        event = await admin.post(f"/events/{event_id}/confirm-payment")
        print_sub(f"Event state is now: {event['state']}")


        # 7. Event Start
        print_step("6. Starting the Event")
        event = await organizer.post(f"/events/{event_id}/start")
        print_sub(f"Event is now LIVE")

        # 8. Enterprises join the event
        print_step("7. Enterprises Join & Setup")
        ent_a_part = await ent_a.post(f"/enterprise/events/{event_id}/join")
        ent_b_part = await ent_b.post(f"/enterprise/events/{event_id}/join")
        
        # Pay for the stand
        print_sub("Enterprises paying for event...")
        await ent_a.post(f"/enterprise/events/{event_id}/pay")
        await ent_b.post(f"/enterprise/events/{event_id}/pay")

        print_sub("Admin approving enterprises to join event...")
        print_sub(f"Ent A Part: {ent_a_part}")
        ent_a_pid = ent_a_part.get("id", ent_a_part.get("_id"))
        ent_b_pid = ent_b_part.get("id", ent_b_part.get("_id"))
        await admin.post(f"/participants/event/{event_id}/{ent_a_pid}/approve")
        await admin.post(f"/participants/event/{event_id}/{ent_b_pid}/approve")

        # Retrieve stands
        print_sub("Fetching enterprise stands...")
        ent_a_stand_resp = await ent_a.get(f"/enterprise/events/{event_id}/stand")
        ent_a_stand_id = ent_a_stand_resp["id"]
        
        ent_b_stand_resp = await ent_b.get(f"/enterprise/events/{event_id}/stand")
        ent_b_stand_id = ent_b_stand_resp["id"]
        
        print_sub(f"Enterprise A stand: {ent_a_stand_id}")
        print_sub(f"Enterprise B stand: {ent_b_stand_id}")

        print_sub("Adding Resources and Products...")
        import urllib.parse
        # Add Resource (uses Form data, so we must encode it correctly for HTTPX or just use form)
        res_data = {
            "title": "A Guide to AI",
            "type": "URL",
            "url": "https://example.com/guide.pdf"
        }
        res_encoded = urllib.parse.urlencode(res_data)
        
        # We need to use normal form submissions for resources
        await ent_a.client.post(f"/enterprise/events/{event_id}/stand/resources", data=res_data)

        # Add Product
        await ent_a.post(f"/enterprise/products", {
            "name": "Super Software Suite",
            "description": "Best in class",
            "category": "Software",
            "price": 199.99,
            "currency": "usd",
            "is_service": False,
            "stock": 100,
            "requires_shipping": False,
            "metadata": {}
        })

        # 9. B2B Meeting
        print_step("8. B2B Networking")
        print_sub("Enterprise A requests meeting with Enterprise B")
        meeting = await ent_a.post("/meetings/", {
            "visitor_id": ent_a.user_data["_id"],
            "stand_id": ent_b_stand_id,
            "purpose": "Partnership Discussion",
            "start_time": "2026-10-02T10:00:00Z",
            "end_time": "2026-10-02T10:30:00Z"
        })
        meeting_id = meeting.get("id", meeting.get("_id"))
        print_sub(f"Enterprise B accepts meeting {meeting_id}")
        await ent_b.patch(f"/meetings/{meeting_id}", {"status": "approved"})


        # 10. Visitor Joins
        print_step("9. Visitor Joins & Explores")
        print_sub("Visitor joins event...")
        await visitor.post(f"/participants/event/{event_id}/request")
        print_sub(f"Visitor adds Stand A ({ent_a_stand_id}) to favorites...")
        await visitor.post("/favorites/", {
            "target_type": "stand",
            "target_id": ent_a_stand_id
        })

        # 11. Chat Simulation
        print_step("10. Chat Simulation")
        # Visitor -> Ent A Chat
        print_sub("Fetching room for Visitor -> Enterprise A...")
        room = await visitor.post(f"/chat/rooms/stand/{ent_a_stand_id}")
        room_id = room.get("id", room.get("_id"))
        
        print_sub(f"Sending WS message to room {room_id}")
        # The WebSocket router is @router.websocket("/ws/chat/{room_id}")
        # So the path is /api/v1/chat/ws/chat/{room_id}?token=...
        async with websockets.connect(f"{WS_URL}/chat/ws/chat/{room_id}?token={visitor.token}") as ws:
            msg = {
                "type": "text",
                "content": "Hello Enterprise A! I saw your stand."
            }
            await ws.send(json.dumps(msg))
            # Just wait a tiny bit to ensure it's sent
            await asyncio.sleep(0.5)
            print_sub("WS Message sent")
            await asyncio.sleep(0.5)
            print_sub("WS Message sent")
            
        print_sub("Fetching room for Enterprise A -> Enterprise B...")
        ent_b_org_id = ent_b_part["organization_id"]
        b2b_room_req = await ent_a.post(f"/chat/rooms/b2b/{ent_b_org_id}")
        b2b_room_id = b2b_room_req.get("id", b2b_room_req.get("_id"))
        
        print_sub(f"Sending WS message to room {b2b_room_id}")
        async with websockets.connect(f"{WS_URL}/chat/ws/chat/{b2b_room_id}?token={ent_a.token}") as ws:
            msg = {
                "type": "text",
                "content": "Hi Ent B, let's discuss details."
            }
            await ws.send(json.dumps(msg))
            await asyncio.sleep(0.5)
            print_sub("B2B WS Message sent")

        # 12. Event End
        print_step("11. Closing Event")
        await organizer.post(f"/events/{event_id}/close")
        print_sub("Event is CLOSED")

        # 13. Notifications check
        print_step("12. Verify Notifications")
        for c in [organizer, ent_a, visitor]:
            notifs = await c.get("/notifications/", {"limit": 5})
            if isinstance(notifs, list):
                print_sub(f"{c.role} has {len(notifs)} notifications. Latest: {notifs[0]['message'] if notifs else 'None'}")
            else:
                print_sub(f"{c.role} notifications: {notifs}")

        # 14. Analytics check
        print_step("13. Fetch Analytics")
        org_stats = await organizer.get(f"/analytics/event/{event_id}")
        print_sub(f"Organizer Stats: {org_stats}")
        
    except httpx.HTTPStatusError as e:
        print_err(f"HTTP ERROR: {e.response.status_code} {e.response.text}")
    except Exception as e:
        print_err(f"UNEXPECTED ERROR: {e}")
        traceback.print_exc()
    finally:
        print_step("CLEANUP")
        await admin.close()
        await visitor.close()
        await organizer.close()
        await ent_a.close()
        await ent_b.close()
        print_step("SIMULATION FINISHED")

if __name__ == "__main__":
    asyncio.run(main())
