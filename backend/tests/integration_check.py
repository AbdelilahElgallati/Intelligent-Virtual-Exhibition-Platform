import sys
import os
import traceback
from fastapi.testclient import TestClient

# Add project root to path
sys.path.append(os.getcwd())

from app.main import app

def test_protected_http(client):
    print("Testing Protected HTTP Endpoint...")
    # Try accessing without token
    response = client.get("/api/v1/meetings/my-meetings")
    if response.status_code == 403 or response.status_code == 401:
        print("PASS: Access denied without token.")
    else:
        print(f"WARN: Expected 403/401, got {response.status_code}")

    # Try accessing with test token
    headers = {"Authorization": "Bearer test-token"}
    response = client.get("/api/v1/meetings/my-meetings", headers=headers)
    
    if response.status_code == 200:
        print("PASS: Access granted with test-token.")
        # print(f"Response: {response.json()}")
    else:
        print(f"FAIL: Expected 200, got {response.status_code}")
        print(response.text)

def test_websocket_auth(client):
    print("\nTesting WebSocket Auth...")
    # Try connecting without token
    try:
        with client.websocket_connect("/api/v1/chat/ws/client1") as websocket:
            websocket.send_text("Hello")
            data = websocket.receive_text()
            print(f"FAIL: Connected without token (Got: {data})")
    except Exception as e:
        print(f"PASS: Connection rejected without token ({e})")

    # Try connecting with token
    try:
        with client.websocket_connect("/api/v1/chat/ws/client1?token=test-token") as websocket:
            websocket.send_text('{"content": "Hello World"}')
            data = websocket.receive_text() # Should be echo
            print(f"PASS: Connected with test-token. Received: {data}")
    except Exception as e:
        print(f"FAIL: Connection failed with test-token ({e})")

if __name__ == "__main__":
    try:
        # Use context manager to trigger lifespan (startup/shutdown)
        with TestClient(app) as client:
            test_protected_http(client)
            test_websocket_auth(client)
        print("\nIntegration Check Complete.")
    except Exception as e:
        print(f"\nCRITICAL FAIL: {e}")
        traceback.print_exc()
        sys.exit(1)
