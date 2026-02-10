import sys
import os
import json
from io import BytesIO
from datetime import datetime, timedelta
import httpx

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
API_BASE = "http://127.0.0.1:8000/api/v1"


def headers(token):
    return {"Authorization": f"Bearer {token}"}


def login(client, email, password):
    r = client.post(f"{API_BASE}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        raise RuntimeError(f"Login failed for {email}: {r.status_code} {r.text}")
    return r.json()


def main():
    report = {"steps": [], "summary": {}}
    with httpx.Client(timeout=30) as client:
        health_resp = client.get("http://127.0.0.1:8000/health")
        health = health_resp.json() if health_resp.status_code == 200 else {"error": health_resp.text}
        report["steps"].append({"health": health})

        admin_tokens = login(client, "admin@ivep.com", "admin123")
        organizer_tokens = login(client, "organizer@ivep.com", "organizer123")
        visitor_tokens = login(client, "visitor@ivep.com", "visitor123")
        report["steps"].append({"admin_login": admin_tokens})
        report["steps"].append({"organizer_login": organizer_tokens})
        report["steps"].append({"visitor_login": visitor_tokens})

        org_resp = client.post(
            f"{API_BASE}/organizations/create",
            headers=headers(organizer_tokens["access_token"]),
            json={"name": "Acme Corp", "description": "Exhibitor"},
        )
        if org_resp.status_code != 200:
            raise RuntimeError(f"Organization create failed: {org_resp.status_code} {org_resp.text}")
        org_create = org_resp.json()
        report["steps"].append({"organization_create": org_create})

        assign_resp = client.post(
            f"{API_BASE}/subscriptions/assign",
            headers=headers(admin_tokens["access_token"]),
            json={"organization_id": org_create["id"], "plan": "pro"},
        )
        if assign_resp.status_code != 200:
            raise RuntimeError(f"Subscription assign failed: {assign_resp.status_code} {assign_resp.text}")
        assign_plan = assign_resp.json()
        report["steps"].append({"subscription_assign": assign_plan})

        event_resp = client.post(
            f"{API_BASE}/events/",
            headers=headers(organizer_tokens["access_token"]),
            json={"title": "Spring Expo", "description": "Annual showcase"},
        )
        if event_resp.status_code != 201:
            raise RuntimeError(f"Event create failed: {event_resp.status_code} {event_resp.text}")
        event_create = event_resp.json()
        report["steps"].append({"event_create": event_create})

        submit_resp = client.post(
            f"{API_BASE}/events/{event_create['id']}/submit",
            headers=headers(organizer_tokens["access_token"]),
        )
        if submit_resp.status_code != 200:
            raise RuntimeError(f"Event submit failed: {submit_resp.status_code} {submit_resp.text}")
        submit = submit_resp.json()
        report["steps"].append({"event_submit": submit})

        approve_resp = client.post(
            f"{API_BASE}/events/{event_create['id']}/approve",
            headers=headers(admin_tokens["access_token"]),
        )
        if approve_resp.status_code != 200:
            raise RuntimeError(f"Event approve failed: {approve_resp.status_code} {approve_resp.text}")
        approve = approve_resp.json()
        report["steps"].append({"event_approve": approve})

        start_resp = client.post(
            f"{API_BASE}/events/{event_create['id']}/start",
            headers=headers(organizer_tokens["access_token"]),
        )
        if start_resp.status_code != 200:
            raise RuntimeError(f"Event start failed: {start_resp.status_code} {start_resp.text}")
        start = start_resp.json()
        report["steps"].append({"event_start": start})

        stand_resp = client.post(
            f"{API_BASE}/events/{event_create['id']}/stands/",
            headers=headers(organizer_tokens["access_token"]),
            json={"organization_id": org_create["id"], "name": "Acme Booth"},
        )
        if stand_resp.status_code != 201:
            raise RuntimeError(f"Stand assign failed: {stand_resp.status_code} {stand_resp.text}")
        stand_assign = stand_resp.json()
        report["steps"].append({"stand_assign": stand_assign})

        file_bytes = BytesIO(b"sample brochure content")
        upload_resp = client.post(
            f"{API_BASE}/resources/upload",
            headers=headers(organizer_tokens["access_token"]),
            files={"file": ("brochure.pdf", file_bytes, "application/pdf")},
            data={"stand_id": str(stand_assign["id"]), "title": "Brochure", "type": "pdf", "description": "Acme brochure"},
        )
        if upload_resp.status_code != 200:
            raise RuntimeError(f"Resource upload failed: {upload_resp.status_code} {upload_resp.text}")
        upload = upload_resp.json()
        report["steps"].append({"resource_upload": upload})

        catalog_resp = client.get(
            f"{API_BASE}/resources/stand/{stand_assign['id']}",
            headers=headers(organizer_tokens["access_token"]),
        )
        catalog = catalog_resp.json() if catalog_resp.status_code == 200 else {"error": catalog_resp.text}
        report["steps"].append({"resource_catalog": catalog})

        track_resp = client.get(
            f"{API_BASE}/resources/{upload['_id']}/track",
            headers=headers(organizer_tokens["access_token"]),
        )
        track = track_resp.json() if track_resp.status_code == 200 else {"error": track_resp.text}
        report["steps"].append({"resource_track": track})

        meeting_resp = client.post(
            f"{API_BASE}/meetings/",
            headers=headers("test-token"),
            json={
                "stand_id": str(stand_assign["id"]),
                "visitor_id": "visitor-456",
                "start_time": (datetime.utcnow() + timedelta(days=2, hours=1)).isoformat() + "Z",
                "end_time": (datetime.utcnow() + timedelta(days=2, hours=1, minutes=30)).isoformat() + "Z",
                "purpose": "Demo request",
            },
        )
        if meeting_resp.status_code != 201:
            raise RuntimeError(f"Meeting request failed: {meeting_resp.status_code} {meeting_resp.text}")
        meeting_req = meeting_resp.json()
        report["steps"].append({"meeting_request": meeting_req})

        update_resp = client.patch(
            f"{API_BASE}/meetings/{meeting_req['_id']}",
            headers=headers(organizer_tokens["access_token"]),
            json={"status": "approved", "notes": "Confirmed"},
        )
        meeting_update = update_resp.json() if update_resp.status_code == 200 else {"error": update_resp.text}
        report["steps"].append({"meeting_update": meeting_update})

        interaction_resp = client.post(
            f"{API_BASE}/leads/interactions",
            headers=headers("test-token"),
            json={
                "visitor_id": "visitor-456",
                "stand_id": str(stand_assign["id"]),
                "interaction_type": "resource_download",
                "metadata": {"resource_id": upload["_id"], "device": "web"},
            },
        )
        interaction = interaction_resp.json() if interaction_resp.status_code == 201 else {"error": interaction_resp.text}
        report["steps"].append({"lead_interaction": interaction})

        leads_resp = client.get(
            f"{API_BASE}/leads/stand/{stand_assign['id']}",
            headers=headers(organizer_tokens["access_token"]),
        )
        leads_list = leads_resp.json() if leads_resp.status_code == 200 else []
        report["steps"].append({"leads_list": leads_list})

        analytics_resp = client.get(
            f"{API_BASE}/analytics/stand/{stand_assign['id']}",
            headers=headers(organizer_tokens["access_token"]),
        )
        analytics_stand = analytics_resp.json() if analytics_resp.status_code == 200 else {"error": analytics_resp.text}
        report["steps"].append({"analytics_stand": analytics_stand})

        report["summary"] = {
            "organization_id": org_create.get("id"),
            "event_id": event_create.get("id"),
            "stand_id": stand_assign.get("id"),
            "resource_id": upload.get("_id"),
            "meeting_id": meeting_req.get("_id"),
            "leads_count": len(leads_list) if isinstance(leads_list, list) else 0,
        }

    print(json.dumps(report, default=str, indent=2))


if __name__ == "__main__":
    main()
