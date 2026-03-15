import re

with open(r"backend\app\modules\enterprise\router.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace enterprise_pay_callback
old_callback = """@router.post("/events/{event_id}/pay-callback")
async def enterprise_pay_callback(event_id: str, request: "Request"):
    \"\"\"Payzone server-to-server callback for enterprise stand fee payments.\"\"\"
    from app.modules.marketplace.payzone_service import verify_callback_signature
    import logging

    logger = logging.getLogger(__name__)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    received_sig = body.get("signature", "")
    if not verify_callback_signature(body, received_sig):
        logger.warning("Payzone enterprise callback signature failed")
        raise HTTPException(status_code=400, detail="Invalid signature")

    payment_status = body.get("status", "")
    transaction_id = body.get("transaction_id", "")
    order_id = body.get("order_id", "")  # participant_id

    if payment_status == "completed" and order_id:
        db = get_database()
        from pymongo import ReturnDocument
        pid = ObjectId(order_id) if ObjectId.is_valid(order_id) else order_id
        updated = await db.participants.find_one_and_update(
            {"_id": pid, "status": ParticipantStatus.PENDING_PAYMENT},
            {"$set": {
                "stand_fee_paid": True,
                "payment_reference": transaction_id,
                "status": ParticipantStatus.PENDING_ADMIN_APPROVAL,
            }},
            return_document=ReturnDocument.AFTER,
        )
        if updated:
            logger.info("Enterprise stand fee paid for participant %s", order_id)

    return {"status": "ok"}"""

new_callback = """@router.post("/events/{event_id}/pay-callback")
async def enterprise_pay_callback(event_id: str, request: "Request"):
    \"\"\"Stripe Webhook callback for enterprise stand fee payments.\"\"\"
    from app.modules.marketplace.stripe_service import construct_event
    import logging

    logger = logging.getLogger(__name__)

    payload = await request.body()
    sig_header = request.headers.get('stripe-signature', '')

    try:
        event_obj = construct_event(payload, sig_header)
    except Exception as e:
        logger.warning(f"Stripe enterprise callback failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event_obj["type"] == "checkout.session.completed":
        session = event_obj["data"]["object"]
        transaction_id = session.get("payment_intent", "")
        metadata = session.get("metadata", {})
        order_id = metadata.get("participant_id")  # participant_id

        if order_id:
            db = get_database()
            from pymongo import ReturnDocument
            pid = ObjectId(order_id) if ObjectId.is_valid(order_id) else order_id
            updated = await db.participants.find_one_and_update(
                {"_id": pid, "status": ParticipantStatus.PENDING_PAYMENT},
                {"$set": {
                    "stand_fee_paid": True,
                    "payment_reference": transaction_id,
                    "status": ParticipantStatus.PENDING_ADMIN_APPROVAL,
                }},
                return_document=ReturnDocument.AFTER,
            )
            if updated:
                logger.info("Enterprise stand fee paid for participant %s", order_id)

    return {"status": "ok"}"""

content = content.replace(old_callback, new_callback)

with open(r"backend\app\modules\enterprise\router.py", "w", encoding="utf-8") as f:
    f.write(content)
