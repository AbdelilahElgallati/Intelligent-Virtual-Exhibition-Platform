import httpx
import starlette
from fastapi.testclient import TestClient

print(f"HTTPX: {httpx.__version__}")
print(f"Starlette: {starlette.__version__}")

try:
    # app is a kwarg in httpx.Client
    c = httpx.Client(app=None)
    print("httpx.Client(app=None) worked")
except Exception as e:
    print(f"httpx.Client(app=None) failed: {e}")

try:
    # TestClient passes app as arg
    tc = TestClient("foo") 
    print("TestClient found")
except Exception as e:
    print(f"TestClient instantiation failed: {e}")
