
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
        
        # 1. Login as Admin
        response = await client.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        if response.status_code != 200:
            print_result("Admin Login", False, f"Status: {response.status_code}, {response.text}")
            return
        admin_token = response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print_result("Admin Login", True)

        # 2. Login as Organizer
        response = await client.post(f"{BASE_URL}/auth/login", json={"email": ORGANIZER_EMAIL, "password": ORGANIZER_PASS})
        if response.status_code != 200:
            print_result("Organizer Login", False, f"Status: {response.status_code}, {response.text}")
            return
        organizer_token = response.json()["access_token"]
        organizer_headers = {"Authorization": f"Bearer {organizer_token}"}
        print_result("Organizer Login", True)

        # 3. Create Organization (as Admin for Organizer)
        # Note: In our current mock implementation, organizer is already owner of a fake org if we implemented it fully, 
        # but let's create a new one to be sure we have an ID.
        org_data = {"name": "Test Org", "description": "A test organization"}
        response = await client.post(f"{BASE_URL}/organizations/create", json=org_data, headers=organizer_headers)
        if response.status_code != 200:
             print_result("Create Org", False, f"Status: {response.status_code}, {response.text}")
             return
        org_id = response.json()["id"]
        print_result("Create Organization", True, f"Org ID: {org_id}")

        # 4. Create Event (Organizer)
        event_data = {"title": "Test Event 2026", "description": "Testing functionality"}
        response = await client.post(f"{BASE_URL}/events/", json=event_data, headers=organizer_headers)
        if response.status_code != 201 and response.status_code != 200:
             print_result("Create Event", False, f"Status: {response.status_code}, {response.text}")
             return
        event_id = response.json()["id"]
        print_result("Create Event", True, f"Event ID: {event_id}")

        # 5. Invite Participant (Organizer invites Visitor)
        # Need visitor ID first. In real app we'd lookup by email, but here we can just login as visitor to get ID or hardcode key.
        # Let's login as visitor
        response = await client.post(f"{BASE_URL}/auth/login", json={"email": VISITOR_EMAIL, "password": VISITOR_PASS})
        visitor_token = response.json()["access_token"]
        # Determine visitor ID from token decoding or /users/me
        response = await client.get(f"{BASE_URL}/users/me", headers={"Authorization": f"Bearer {visitor_token}"})
        visitor_id = response.json()["id"]
        
        invite_data = {"user_id": visitor_id}
        response = await client.post(f"{BASE_URL}/events/{event_id}/participants/invite", json=invite_data, headers=organizer_headers)
        if response.status_code != 201 and response.status_code != 200:
             print_result("Invite Participant", False, f"Status: {response.status_code}, {response.text}")
        else:
             print_result("Invite Participant", True)

        # 6. Create Stand (Organizer assigns stand to Org)
        stand_data = {"organization_id": org_id, "name": "Tech Stand"}
        response = await client.post(f"{BASE_URL}/events/{event_id}/stands/", json=stand_data, headers=organizer_headers)
        if response.status_code != 201 and response.status_code != 200:
             print_result("Create Stand", False, f"Status: {response.status_code}, {response.text}")
        else:
             print_result("Create Stand", True)
             
        # 7. Assign Subscription (Admin)
        sub_data = {"organization_id": org_id, "plan": "pro"}
        response = await client.post(f"{BASE_URL}/subscriptions/assign", json=sub_data, headers=admin_headers)
        if response.status_code != 200:
             print_result("Assign Subscription", False, f"Status: {response.status_code}, {response.text}")
        else:
             print_result("Assign Subscription", True, f"Plan: {response.json()['plan']}")

        # 8. Check Feature Gating (Organizer checks limit)
        # We need to trigger the require_feature check. 
        # Currently it's a dependency providing checking logic but where is it used?
        # Aah, I added the dependency to dependencies.py but didn't enforce it on any route yet!
        # The prompt asked to "Use it to protect at least: Event creation limit".
        # I need to update the event creation route to use this dependency.
        
        print("\nNote: Feature gating check skipped in script (will implement enforcement next).")

if __name__ == "__main__":
    asyncio.run(run_tests())
