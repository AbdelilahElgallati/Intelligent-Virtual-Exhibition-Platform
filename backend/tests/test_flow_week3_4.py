
import asyncio
import uuid
import sys
from datetime import datetime

import httpx
from pydantic import BaseModel

# Configuration
BASE_URL = "http://127.0.0.1:8000/api/v1"
ADMIN_EMAIL = "admin@ivep.com"
ADMIN_PASS = "admin123"
ORGANIZER_EMAIL = "organizer@ivep.com"
ORGANIZER_PASS = "organizer123"
VISITOR_EMAIL = "visitor@ivep.com"
VISITOR_PASS = "visitor123"

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"

def print_result(step: str, success: bool, details: str = ""):
    status = f"{GREEN}PASS{RESET}" if success else f"{RED}FAIL{RESET}"
    print(f"[{status}] {step}")
    if details:
        print(f"       Details: {details}")

async def run_tests():
    async with httpx.AsyncClient(timeout=10.0) as client:
        print(f"Running integration tests against {BASE_URL}...")
        
        # 1. Login as Admin, Organizer, Visitor
        # Admin
        resp = await client.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        if resp.status_code != 200:
            print_result("Admin Login", False, resp.text)
            return
        admin_token = resp.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Organizer
        resp = await client.post(f"{BASE_URL}/auth/login", json={"email": ORGANIZER_EMAIL, "password": ORGANIZER_PASS})
        if resp.status_code != 200:
            print_result("Organizer Login", False, resp.text)
            return
        organizer_token = resp.json()["access_token"]
        organizer_headers = {"Authorization": f"Bearer {organizer_token}"}
        
        # Visitor
        resp = await client.post(f"{BASE_URL}/auth/login", json={"email": VISITOR_EMAIL, "password": VISITOR_PASS})
        if resp.status_code != 200:
            print_result("Visitor Login", False, resp.text)
            return
        visitor_token = resp.json()["access_token"]
        visitor_headers = {"Authorization": f"Bearer {visitor_token}"}
        
        # Get Visitor ID
        resp = await client.get(f"{BASE_URL}/users/me", headers=visitor_headers)
        visitor_id = resp.json()["id"]
        
        print_result("Authentication", True)


        # --- ANALYTICS TEST ---
        # 2. Log Analytics Event (Visitor views event)
        # Using a fake event ID for logging test
        fake_event_id = str(uuid.uuid4())
        analytics_data = {
            "type": "event_view",
            "event_id": fake_event_id
        }
        resp = await client.post(f"{BASE_URL}/analytics/log", json=analytics_data, headers=visitor_headers)
        if resp.status_code != 201:
            print_result("Log Analytics", False, resp.text)
        else:
            print_result("Log Analytics", True)
            
        # 3. List Analytics (Admin)
        resp = await client.get(f"{BASE_URL}/analytics/", headers=admin_headers)
        if resp.status_code != 200:
             print_result("List Analytics", False, resp.text)
        else:
             events = resp.json()
             if len(events) > 0 and events[0]["type"] == "event_view":
                  print_result("List Analytics", True, f"Found {len(events)} events")
             else:
                  print(f"DEBUG: events content: {events}")
                  print_result("List Analytics", False, f"No events found or mismatch. Content: {events}")


        # --- NOTIFICATIONS TEST ---
        # 4. Create Event (Organizer)
        event_data = {"title": "Notification Test Event", "description": "Testing notifications"}
        resp = await client.post(f"{BASE_URL}/events/", json=event_data, headers=organizer_headers)
        if resp.status_code not in [200, 201]:
             print_result("Create Event", False, resp.text)
             return
        event_id = resp.json()["id"]
        
        # 5. Submit Event (Organizer)
        resp = await client.post(f"{BASE_URL}/events/{event_id}/submit", headers=organizer_headers)
        if resp.status_code != 200:
             print_result("Submit Event", False, resp.text)
             return
             
        # 6. Approve Event (Admin) -> Should notify Organizer
        resp = await client.post(f"{BASE_URL}/events/{event_id}/approve", headers=admin_headers)
        if resp.status_code != 200:
             print_result("Approve Event", False, resp.text)
        else:
             print_result("Approve Event", True)
             
        # 7. Check Organizer Notifications
        resp = await client.get(f"{BASE_URL}/notifications/", headers=organizer_headers)
        notifs = resp.json()
        found_approval = False
        for n in notifs:
            if n["type"] == "event_approved" and "Notification Test Event" in n["message"]:
                found_approval = True
                break
        
        print_result("Notification: Event Approved", found_approval, f"Found {len(notifs)} notifications")

        # 8. Invite Participant (Organizer invites Visitor) -> Should notify Visitor
        invite_data = {"user_id": visitor_id}
        resp = await client.post(f"{BASE_URL}/events/{event_id}/participants/invite", json=invite_data, headers=organizer_headers)
        if resp.status_code not in [200, 201]:
             print_result("Invite Participant", False, resp.text)
        else:
             print_result("Invite Participant", True)
             
        # 9. Check Visitor Notifications
        resp = await client.get(f"{BASE_URL}/notifications/", headers=visitor_headers)
        notifs = resp.json()
        found_invite = False
        invite_notif_id = None
        for n in notifs:
            if n["type"] == "invitation_sent" and "Notification Test Event" in n["message"]:
                found_invite = True
                invite_notif_id = n["id"]
                break
        
        print_result("Notification: Invitation Received", found_invite)

        # 10. Mark Notification as Read
        if invite_notif_id:
            resp = await client.post(f"{BASE_URL}/notifications/{invite_notif_id}/read", headers=visitor_headers)
            if resp.status_code == 200 and resp.json()["is_read"] == True:
                print_result("Mark Notification Read", True)
            else:
                print_result("Mark Notification Read", False, resp.text)

if __name__ == "__main__":
    asyncio.run(run_tests())
