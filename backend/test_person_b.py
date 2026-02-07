import asyncio
import httpx
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"

async def test_person_b_features():
    async with httpx.AsyncClient(timeout=10.0, headers={"Authorization": "Bearer test-token"}) as client:
        print("\n🚀 Starting Person B Feature Verification...\n")

        # 1. Test Analytics
        print("📊 [Analytics] Testing get_stand_analytics...")
        try:
            resp = await client.get(f"{BASE_URL}/analytics/stand/test-stand-123")
            if resp.status_code == 200:
                print("✅ Analytics retrieved successfully.")
            else:
                print(f"❌ Analytics failed: {resp.status_code}")
        except Exception as e:
            print(f"❌ Analytics request failed: {e}")

        # 2. Test Meetings
        print("\n📅 [Meetings] Testing meeting creation...")
        from datetime import timedelta
        now = datetime.utcnow()
        meeting_data = {
            "stand_id": "test-stand-123",
            "visitor_id": "visitor-456",
            "start_time": now.isoformat(),
            "end_time": (now + timedelta(minutes=30)).isoformat(),
            "purpose": "Business Inquiry"
        }
        try:
            resp = await client.post(f"{BASE_URL}/meetings/", json=meeting_data)
            if resp.status_code == 201:
                meeting = resp.json()
                print(f"✅ Meeting created. ID: {meeting.get('_id')}")
                
                # Test retrieving meetings
                resp = await client.get(f"{BASE_URL}/meetings/my-meetings")
                if resp.status_code == 200:
                    print(f"✅ Retrieved {len(resp.json())} visitor meetings.")
                
                # Test retrieving stand meetings
                resp = await client.get(f"{BASE_URL}/meetings/stand/test-stand-123")
                if resp.status_code == 200:
                    print(f"✅ Retrieved {len(resp.json())} stand meetings.")
            else:
                print(f"❌ Meeting creation failed: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"❌ Meeting request failed: {e}")

        # 3. Test Resources
        print("\n📂 [Resources] Testing resource catalog...")
        try:
            resp = await client.get(f"{BASE_URL}/resources/stand/test-stand-123")
            if resp.status_code == 200:
                print(f"✅ Resource catalog retrieved. Count: {len(resp.json())}")
            else:
                print(f"❌ Resource catalog failed: {resp.status_code}")
        except Exception as e:
            print(f"❌ Resource request failed: {e}")

        # 4. Test Leads
        print("\n👥 [Leads] Testing lead interaction logging...")
        interaction = {
            "visitor_id": "visitor-456",
            "stand_id": "test-stand-123",
            "interaction_type": "chat",
            "metadata": {"message_count": "5"}
        }
        try:
            resp = await client.post(f"{BASE_URL}/leads/interactions", json=interaction)
            if resp.status_code == 201:
                print("✅ Interaction logged successfully.")
                
                # Get leads
                resp = await client.get(f"{BASE_URL}/leads/stand/test-stand-123")
                if resp.status_code == 200:
                    print(f"✅ Retrieved {len(resp.json())} leads for stand.")
            else:
                print(f"❌ Leads logging failed: {resp.status_code}")
        except Exception as e:
            print(f"❌ Leads request failed: {e}")

        # 5. Test Recommendations
        print("\n✨ [Recommendations] Testing hybrid filtering...")
        try:
            resp = await client.get(f"{BASE_URL}/recommendations/user/visitor-456?limit=5")
            if resp.status_code == 200:
                print(f"✅ Recommendations retrieved. Count: {len(resp.json())}")
            else:
                print(f"❌ Recommendations failed: {resp.status_code}")
        except Exception as e:
            print(f"❌ Recommendations request failed: {e}")

        print("\n🏁 Verification Complete!")

if __name__ == "__main__":
    try:
        asyncio.run(test_person_b_features())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"Fatal error: {e}")
