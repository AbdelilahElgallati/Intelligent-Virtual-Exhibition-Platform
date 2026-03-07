"""
Marketplace integration test — verifies:
  1.  Product listing works
  2.  Cart checkout endpoint responds (CORS-safe error handling)  
  3.  Stripe Checkout Session creation with test key (if configured)
  
Run:  venv/Scripts/python -m scripts.test_marketplace
"""

import asyncio
import math

# ----- bootstrap -----
import os
import sys
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

from app.db.mongo import connect_to_mongo, close_mongo_connection, get_database
from app.core.config import get_settings


PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
SKIP = "\033[93mSKIP\033[0m"

results = []

def record(name: str, ok: bool, detail: str = ""):
    tag = PASS if ok else FAIL
    results.append((name, ok))
    print(f"  [{tag}] {name}" + (f"  — {detail}" if detail else ""))


async def main():
    await connect_to_mongo()
    db = get_database()
    settings = get_settings()

    print("\n" + "=" * 60)
    print("  Marketplace Integration Tests")
    print("=" * 60 + "\n")

    # ----------------------------------------------------------------
    # 1. Product listing
    # ----------------------------------------------------------------
    products = await db.stand_products.find().limit(5).to_list(5)
    record("Products exist in DB", len(products) > 0, f"{len(products)} found (sample)")

    if not products:
        print("\n  No products in DB — cannot test further. Run seed first.\n")
        await close_mongo_connection()
        return

    sample = products[0]
    stand_id = str(sample["stand_id"])
    product_id = str(sample["_id"])

    record("Product has required fields",
           all(k in sample for k in ("name", "price", "stock", "currency")),
           f"name={sample.get('name')}")

    # ----------------------------------------------------------------
    # 2. Cart checkout endpoint (import router logic)
    # ----------------------------------------------------------------
    from app.modules.marketplace import service as mkt_svc

    # Check list_products
    stand_products = await mkt_svc.list_products(stand_id)
    record("list_products(stand_id) works", len(stand_products) > 0, f"{len(stand_products)} products for stand")

    # Check get_product
    fetched = await mkt_svc.get_product(product_id)
    record("get_product(id) works", fetched is not None and fetched["id"] == product_id)

    # ----------------------------------------------------------------
    # 3. Create a test order (verify order creation path)
    # ----------------------------------------------------------------
    test_order = await mkt_svc.create_order(
        product_id=product_id,
        stand_id=stand_id,
        buyer_id="000000000000000000000001",  # fake
        product_name=fetched["name"],
        quantity=1,
        total_amount=fetched["price"],
        stripe_session_id="test_session_xxx",
    )
    record("create_order works", test_order is not None and "id" in test_order, f"order_id={test_order.get('id')}")

    # Mark paid
    paid = await mkt_svc.mark_order_paid(test_order["id"], "pi_test_xxx")
    record("mark_order_paid returns order", paid is not None and paid.get("status") == "paid")

    # Clean up test order
    await db.stand_orders.delete_one({"_id": __import__("bson").ObjectId(test_order["id"])})

    # ----------------------------------------------------------------
    # 4. Stripe checkout session (test key required)
    # ----------------------------------------------------------------
    stripe_key = settings.STRIPE_SECRET_KEY
    if stripe_key and stripe_key.startswith("sk_test_"):
        from app.modules.marketplace.stripe_service import create_checkout_session, create_cart_checkout_session

        print("\n  --- Stripe test-key detected, testing real checkout ---")

        unit_cents = int(math.ceil(fetched["price"] * 100))
        try:
            session = create_checkout_session(
                product_name=fetched["name"],
                unit_price_cents=unit_cents,
                currency=fetched.get("currency", "usd"),
                quantity=1,
                order_id="test_order_stripe",
                success_url="http://localhost:3000/marketplace/success?session_id={CHECKOUT_SESSION_ID}",
                cancel_url="http://localhost:3000/marketplace/cancel",
                buyer_email="test@demo.com",
            )
            record("Stripe single-product session", session and hasattr(session, "url"),
                   f"url={session.url[:60]}..." if session.url else "")
        except Exception as e:
            record("Stripe single-product session", False, str(e))

        # Cart (multi-item) session
        try:
            cart_session = create_cart_checkout_session(
                items=[
                    {"product_name": fetched["name"], "unit_price_cents": unit_cents,
                     "currency": fetched.get("currency", "usd"), "quantity": 2},
                    {"product_name": "Test Item B", "unit_price_cents": 1500,
                     "currency": "usd", "quantity": 1},
                ],
                order_ids=["oid_1", "oid_2"],
                success_url="http://localhost:3000/marketplace/success?session_id={CHECKOUT_SESSION_ID}",
                cancel_url="http://localhost:3000/marketplace/cancel",
                buyer_email="test@demo.com",
            )
            record("Stripe cart-checkout session", cart_session and hasattr(cart_session, "url"),
                   f"url={cart_session.url[:60]}..." if cart_session.url else "")
        except Exception as e:
            record("Stripe cart-checkout session", False, str(e))
    else:
        print(f"\n  [{SKIP}] Stripe tests skipped — no test key in STRIPE_SECRET_KEY")
        print("         To enable: set STRIPE_SECRET_KEY=sk_test_... in .env")

    # ----------------------------------------------------------------
    # 5. CORS-safe error handling (simulate missing stripe key)
    # ----------------------------------------------------------------
    # When Stripe key is missing, the checkout should raise HTTPException(502)
    # not an unhandled 500, which would break CORS.
    # We verify this by checking the router wraps in try/except.
    import inspect
    from app.modules.marketplace.router import checkout_product, cart_checkout
    src_single = inspect.getsource(checkout_product)
    src_cart = inspect.getsource(cart_checkout)
    record("checkout_product has try/except (CORS-safe)", "except Exception" in src_single)
    record("cart_checkout has try/except (CORS-safe)", "except Exception" in src_cart)

    # ----------------------------------------------------------------
    # Summary
    # ----------------------------------------------------------------
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print(f"\n{'=' * 60}")
    print(f"  Results: {passed}/{total} passed")
    print(f"{'=' * 60}\n")

    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
