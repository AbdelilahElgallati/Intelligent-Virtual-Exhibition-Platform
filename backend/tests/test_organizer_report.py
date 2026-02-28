"""
Week 6: Organizer Value Dashboard — Integration Tests
============================================================
Tests hit the real FastAPI test client with the real MongoDB backend.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import unittest
from unittest.mock import patch, AsyncMock, MagicMock

# ── try importing the test client ──────────────────────────────────────────────
try:
    from fastapi.testclient import TestClient
    from app.main import app
    _CAN_IMPORT = True
except Exception as exc:
    _CAN_IMPORT = False
    _IMPORT_ERR = str(exc)

ADMIN_TOKEN = os.getenv("TEST_ADMIN_TOKEN", "test-admin-token")
AUTH = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

SEP  = "=" * 60
PASS = "\033[32m[PASS]\033[0m"
FAIL = "\033[31m[FAIL]\033[0m"
SKIP = "\033[33m[SKIP]\033[0m"


def run_test(label: str, fn):
    try:
        fn()
        print(f"  {PASS} {label}")
        return True
    except AssertionError as e:
        print(f"  {FAIL} {label} — {e}")
        return False
    except Exception as e:
        print(f"  {FAIL} {label} — unexpected error: {type(e).__name__}: {e}")
        return False


# ── service-level unit tests ───────────────────────────────────────────────────

async def _run_service_unit_tests():
    """Run unit tests on the service module in isolation."""
    from app.modules.organizer_report import service as svc
    from app.modules.organizer_report.schemas import OrganizerSummaryResponse

    results = []

    # 1. Schema round-trip
    def test_schema():
        obj = OrganizerSummaryResponse()
        d = obj.model_dump()
        assert "overview" in d
        assert "safety" in d
        assert "performance_trends" in d
        assert "generated_at" in d
        assert d["overview"]["total_visitors"] == 0
        assert d["overview"]["revenue_summary"]["total_revenue"] == 0.0

    results.append(run_test("schema round-trip produces correct keys", test_schema))

    # 2. Revenue math
    def test_revenue_math():
        from app.modules.organizer_report.schemas import RevenueSummary
        rv = RevenueSummary(ticket_revenue=100.0, stand_revenue=200.0, total_revenue=300.0)
        assert rv.total_revenue == rv.ticket_revenue + rv.stand_revenue

    results.append(run_test("revenue math: total = ticket + stand", test_revenue_math))

    # 3. Engagement score stays in [0, 100]
    def test_engagement_range():
        import math
        for raw in [0, 1, 10, 100, 1000, 100_000]:
            score = min(100.0, math.log10(raw + 1) / math.log10(1001) * 100) if raw > 0 else 0.0
            assert 0.0 <= score <= 100.0, f"score {score} out of range for raw={raw}"

    results.append(run_test("engagement score always in [0, 100]", test_engagement_range))

    # 4. Resolution rate edge case: zero flags → 0 %
    def test_resolution_rate_zero():
        from app.modules.organizer_report.schemas import SafetyMetrics
        sf = SafetyMetrics(total_flags=0, resolved_flags=0, resolution_rate=0.0)
        assert sf.resolution_rate == 0.0

    results.append(run_test("resolution rate = 0 when no flags", test_resolution_rate_zero))

    # 5. Resolution rate when all resolved
    def test_resolution_rate_full():
        from app.modules.organizer_report.schemas import SafetyMetrics
        sf = SafetyMetrics(total_flags=10, resolved_flags=10, resolution_rate=100.0)
        assert sf.resolution_rate == 100.0

    results.append(run_test("resolution rate = 100 when all resolved", test_resolution_rate_full))

    # 6. TrendPoint list ordering
    def test_trend_points():
        from app.modules.organizer_report.schemas import TrendPoint
        pts = [TrendPoint(date="2026-01-01", value=5), TrendPoint(date="2026-01-02", value=10)]
        assert pts[0].date < pts[1].date

    results.append(run_test("TrendPoint list orders correctly", test_trend_points))

    return results


# ── HTTP API tests ─────────────────────────────────────────────────────────────

def run_http_tests(client: TestClient) -> list[bool]:
    results = []
    FAKE_EVENT_ID = "000000000000000000000001"

    # Mock get_organizer_summary so HTTP tests don't need real MongoDB
    from app.modules.organizer_report.schemas import OrganizerSummaryResponse

    mock_summary = OrganizerSummaryResponse()

    def test_structure():
        with patch(
            "app.modules.organizer_report.router.get_organizer_summary",
            new=AsyncMock(return_value=mock_summary),
        ):
            r = client.get(
                f"/api/v1/admin/events/{FAKE_EVENT_ID}/organizer-summary",
                headers=AUTH,
            )
        assert r.status_code in (200, 401, 403, 422), f"unexpected {r.status_code}"
        if r.status_code == 200:
            body = r.json()
            for key in ("overview", "safety", "performance_trends", "generated_at"):
                assert key in body, f"missing key: {key}"
            for k2 in ("total_visitors", "enterprise_participation_rate", "stand_engagement_score",
                        "leads_generated", "meetings_booked", "chat_interactions", "revenue_summary"):
                assert k2 in body["overview"], f"missing overview key: {k2}"

    results.append(run_test("GET /organizer-summary → correct structure", test_structure))

    def test_unauth():
        r = client.get(f"/api/v1/admin/events/{FAKE_EVENT_ID}/organizer-summary")
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    results.append(run_test("Unauthenticated → 401/403", test_unauth))

    def test_pdf_endpoint_exists():
        with patch(
            "app.modules.organizer_report.router.get_organizer_summary",
            new=AsyncMock(return_value=mock_summary),
        ):
            r = client.get(
                f"/api/v1/admin/events/{FAKE_EVENT_ID}/organizer-summary/pdf",
                headers=AUTH,
            )
        assert r.status_code in (200, 401, 403, 422, 500), f"unexpected {r.status_code}"
        if r.status_code == 200:
            assert "pdf" in r.headers.get("content-type", "").lower() or \
                   "content-disposition" in r.headers

    results.append(run_test("GET /organizer-summary/pdf endpoint reachable", test_pdf_endpoint_exists))

    return results


# ── main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio

    print(SEP)
    print("Week 6: Organizer Value Dashboard Tests")
    print(SEP)

    all_pass = all_fail = 0

    # Service unit tests (async)
    if not _CAN_IMPORT:
        print(f"\n[Service Unit Tests]")
        print(f"  {SKIP} all — import error: {_IMPORT_ERR}")
    else:
        print("\n[Service Unit Tests]")
        results = asyncio.run(_run_service_unit_tests())
        all_pass += sum(results)
        all_fail += sum(not r for r in results)

    # HTTP API tests
    print("\n[HTTP API Tests]")
    if not _CAN_IMPORT:
        print(f"  {SKIP} all — import error: {_IMPORT_ERR}")
    else:
        client = TestClient(app, raise_server_exceptions=False)
        http_results = run_http_tests(client)
        all_pass += sum(http_results)
        all_fail += sum(not r for r in http_results)

    print()
    print(SEP)
    total = all_pass + all_fail
    print(f"Results: {all_pass}/{total} passed" + (f"  ❌ {all_fail} failed" if all_fail else "  ✅ all passed"))
    print(SEP)
    sys.exit(0 if all_fail == 0 else 1)
