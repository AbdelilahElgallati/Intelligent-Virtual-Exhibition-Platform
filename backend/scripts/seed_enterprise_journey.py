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
    print(f"\n{'='*60}")
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")
    print(f"{'='*60}")

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
        self.client = httpx.AsyncClient(base_url=API_URL, timeout=60.0, follow_redirects=True)

    def set_token(self, token: str):
        self.token = token
        self.client.headers.update({"Authorization": f"Bearer {token}"})

    async def post(self, endpoint: str, json_data: dict = None, data: dict = None, files: dict = None, params: dict = None):
        resp = await self.client.post(endpoint, json=json_data, data=data, files=files, params=params)
        try:
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            print_err(f"POST {endpoint} failed: {e.response.text}")
            raise e

    async def patch(self, endpoint: str, json_data: dict = None):
        resp = await self.client.patch(endpoint, json=json_data)
        try:
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            print_err(f"PATCH {endpoint} failed: {e.response.text}")
            raise e

    async def get(self, endpoint: str, params: dict = None):
        resp = await self.client.get(endpoint, params=params)
        try:
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            print_err(f"GET {endpoint} failed: {e.response.text}")
            raise e
    
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
    if resp.status_code == 400 and "Email already registered" in resp.text:
        print_sub(f"Email already registered: {client.email}, ignoring.")
    else:
        resp.raise_for_status()
    return resp

async def login_user(client: APIClient):
    print_sub(f"Logging in {client.role}: {client.email}")
    data = {"email": client.email, "password": client.password}
    resp = await client.post("/auth/login", json_data=data)
    client.set_token(resp["access_token"])
    client.user_data = resp["user"]
    return resp

# ----- Journey Simulation -----

# --- TEST ACCOUNTS ---
EMAIL_ORG = "organizer.test@ivep.com"
EMAIL_ENT_A = "tech.solutions@ivep.com"
EMAIL_ENT_B = "cloud.infra@ivep.com"
EMAIL_VISITOR = "visitor.test@gmail.com"
ADMIN_EMAIL = "admin@demo.com"
TEST_PASSWORD = "password123!"
ADMIN_PASSWORD = "Password123!"

async def run_journey():
    clients = []
    
    try:
        print_step("PHASE 1: REGISTRATION & SETUP")
        
        # 1. Setup Identities
        admin = APIClient(ADMIN_EMAIL, "admin")
        admin.password = ADMIN_PASSWORD
        organizer = APIClient(EMAIL_ORG, "organizer")
        enterprise_a = APIClient(EMAIL_ENT_A, "enterprise")
        enterprise_b = APIClient(EMAIL_ENT_B, "enterprise")
        visitor = APIClient(EMAIL_VISITOR, "visitor")
        
        clients = [admin, organizer, enterprise_a, enterprise_b, visitor]

        # 2. Registration
        await register_user(organizer, {"org_name": "Global Tech Expo 2026"})
        await register_user(enterprise_a, {
            "company_name": "TechEd Solutions",
            "industry": "Education Tech",
            "description": "Innovative learning platforms",
            "company_size": "50-200",
            "location_country": "USA"
        })
        await register_user(enterprise_b, {
            "company_name": "CloudFlow Systems",
            "industry": "Cloud Computing",
            "description": "Scalable infra for everyone",
            "company_size": "10-50",
            "location_country": "UK"
        })
        await register_user(visitor)

        # 3. Admin Approvals
        await login_user(admin)
        registrations = await admin.get("/admin/enterprise-registrations")
        for reg in registrations.get("registrations", []):
            if reg["email"] in [enterprise_a.email, enterprise_b.email]:
                await admin.post(f"/admin/enterprise-registrations/{reg['_id']}/approve")
        
        org_regs = await admin.get("/admin/organizer-registrations")
        for reg in org_regs.get("registrations", []):
            if reg["email"] == organizer.email:
                await admin.post(f"/admin/organizer-registrations/{reg['_id']}/approve")

        # 4. Log in everyone
        for c in [organizer, enterprise_a, enterprise_b, visitor]:
            await login_user(c)

        print_step("PHASE 2: EVENT & PARTICIPATION")

        # 1. Create Event
        event = await organizer.post("/events/", {
            "title": "Future Tech Summit 2026",
            "description": "Connecting the world of tech.",
            "start_date": "2026-11-01T09:00:00Z",
            "end_date": "2026-11-03T18:00:00Z",
            "location": "Virtual Exhibition Hall",
            "category": "Technology",
            "num_enterprises": 5,
            "stand_price": 150.0,
            "event_timeline": "Day 1: Keynote\nDay 2: Panels",
            "extended_details": "This is a detailed description of the tech summit with a lot of information."
        })
        event_id = event.get("id", event.get("_id"))
        print_sub(f"Event Created: {event_id}")

        # 2. Admin Approve & Pay Event
        await admin.post(f"/events/{event_id}/approve", {"payment_amount": 300.0})
        await organizer.post(f"/events/{event_id}/submit-proof", params={"proof_url": "mock_receipt.pdf"})
        await admin.post(f"/events/{event_id}/confirm-payment")
        await organizer.post(f"/events/{event_id}/start")
        print_sub("Event is now LIVE")

        # 3. Enterprises Join
        for ent in [enterprise_a, enterprise_b]:
            await ent.post(f"/enterprise/events/{event_id}/join")
            await ent.post(f"/enterprise/events/{event_id}/pay")
            
            # Admin approves participation
            parts = await admin.get(f"/participants/event/{event_id}")
            part_id = next(p["_id"] for p in parts if p["user_id"] == str(ent.user_data["_id"]))
            await admin.post(f"/participants/event/{event_id}/{part_id}/approve")
            print_sub(f"{ent.email} joined and approved")

        print_step("PHASE 3: PROFILE & STAND CONFIG")

        # 1. Fill Enterprise A Profile
        await enterprise_a.patch("/enterprise/profile", {
            "website": "https://teched.solutions",
            "linkedin": "https://linkedin.com/company/teched",
            "tags": ["AI", "Learning", "SaaS"]
        })
        
        # 2. Add Products for Enterprise A
        prod_a = await enterprise_a.post("/enterprise/products", {
            "name": "Smart Tutor AI",
            "description": "Personalized learning assistant",
            "category": "Software",
            "price": 49.99,
            "is_service": False,
            "is_active": True
        })
        prod_id_a = prod_a.get("id", prod_a.get("_id"))
        print_sub(f"Product added for A: {prod_id_a}")

        # 3. Configure Stand A
        stand_a = await enterprise_a.get(f"/enterprise/events/{event_id}/stand")
        stand_id_a = stand_a.get("id", stand_a.get("_id"))
        await enterprise_a.patch(f"/enterprise/events/{event_id}/stand", {
            "description": "Welcome to TechEd! Explore our AI tools.",
            "theme_color": "#4F46E5"
        })
        await enterprise_a.patch(f"/enterprise/events/{event_id}/stand/products", [prod_id_a])
        
        # Upload Resource
        await enterprise_a.post(f"/enterprise/events/{event_id}/stand/resources", data={
            "title": "Platform Demo Video",
            "type": "Video",
            "url": "https://youtube.com/watch?v=demo"
        })
        
        # 3. Enable AI Assistant
        print_sub("Enabling AI Assistant (Indexing resources)...")
        await enterprise_a.post(f"/enterprise/events/{event_id}/stand/enable-assistant")
        print_sub("Stand A configured and AI enabled")

        print_step("PHASE 4: LIVE INTERACTIONS & LEADS")

        # 1. Visitor Interacts
        await visitor.post(f"/participants/event/{event_id}/request") # Join as visitor
        
        # Chat Visitor -> A
        room_v_a = await visitor.post(f"/chat/rooms/stand/{stand_id_a}")
        room_v_a_id = room_v_a.get("id", room_v_a.get("_id"))
        async with websockets.connect(f"{WS_URL}/chat/ws/chat/{room_v_a_id}?token={visitor.token}") as ws:
            await ws.send(json.dumps({"type": "text", "content": "I'm interested in the Smart Tutor AI!"}))
            await asyncio.sleep(0.5)
            await ws.send(json.dumps({"type": "text", "content": "Do you offer institutional discounts?"}))
            await asyncio.sleep(0.5)

        # Visitor -> Enterprise A Meeting
        await visitor.post("/meetings/", {
            "visitor_id": str(visitor.user_data["_id"]),
            "stand_id": stand_id_a,
            "start_time": "2026-11-02T11:00:00Z",
            "end_time": "2026-11-02T11:30:00Z",
            "purpose": "Institutional Pricing Inquiry"
        })
        print_sub("Visitor requested a meeting with Enterprise A")

        # Product Request
        prod_id_a = prod_a.get("id", prod_a.get("_id"))
        await visitor.post(f"/enterprise/public/products/{prod_id_a}/request", {
            "product_id": prod_id_a,
            "event_id": event_id,
            "message": "Send me a quote please.",
            "quantity": 5
        })
        print_sub("Visitor interaction complete")

        # 2. B2B Interaction
        stand_b = await enterprise_b.get(f"/enterprise/events/{event_id}/stand")
        stand_id_b = stand_b.get("id", stand_b.get("_id"))
        org_id_b = stand_b.get("organization_id")
        
        # B2B Chat A -> B
        room_a_b = await enterprise_a.post(f"/chat/rooms/b2b/{org_id_b}")
        room_a_b_id = room_a_b.get("id", room_a_b.get("_id"))
        async with websockets.connect(f"{WS_URL}/chat/ws/chat/{room_a_b_id}?token={enterprise_a.token}") as ws:
            await ws.send(json.dumps({"type": "text", "content": "Hey CloudFlow, can we discuss cloud licenses?"}))
            await asyncio.sleep(0.5)
            await ws.send(json.dumps({"type": "text", "content": "We need around 50 instances for our summer camp."}))
            await asyncio.sleep(0.5)

        # B2B Meeting A -> B
        await enterprise_a.post("/meetings/", {
            "visitor_id": str(enterprise_a.user_data["_id"]),
            "stand_id": stand_id_b,
            "start_time": "2026-11-02T14:00:00Z",
            "end_time": "2026-11-02T14:30:00Z",
            "purpose": "Infrastructure Partnership Discussion"
        })
        print_sub("B2B interaction complete (Chat & Meeting)")

        # 3. Lead Capture Check
        leads = await enterprise_a.get(f"/leads/stand/{stand_id_a}")
        print_sub(f"Enterprise A Leads: {len(leads)}")
        for lead in leads:
            print_sub(f" - Found Lead: {lead['visitor_name']} (Interactions: {lead['interactions_count']})")

        print_step("JOURNEY COMPLETED SUCCESSFULLY")
        
        print("\nTEST ACCOUNTS FOR FRONTEND:")
        print("-" * 60)
        print(f"{'Role':<15} | {'Email':<30} | {'Password'}")
        print("-" * 60)
        print(f"{'Admin':<15} | {ADMIN_EMAIL:<30} | {ADMIN_PASSWORD}")
        print(f"{'Organizer':<15} | {EMAIL_ORG:<30} | {TEST_PASSWORD}")
        print(f"{'Enterprise A':<15} | {EMAIL_ENT_A:<30} | {TEST_PASSWORD}")
        print(f"{'Enterprise B':<15} | {EMAIL_ENT_B:<30} | {TEST_PASSWORD}")
        print(f"{'Visitor':<15} | {EMAIL_VISITOR:<30} | {TEST_PASSWORD}")
        print("-" * 60)
        print(f"\nEvent ID: {event_id}")
        print(f"Stand A ID: {stand_id_a}")
        print("-" * 60)

    except Exception as e:
        print_err(f"Simulation failed: {e}")
        traceback.print_exc()
    finally:
        for c in clients:
            await c.close()

if __name__ == "__main__":
    asyncio.run(run_journey())
