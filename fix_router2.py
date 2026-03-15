import re

with open(r'.\backend\app\modules\payments\router.py', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = re.compile(r'@router\.post\(\"/events/\{event_id\}/payment-callback\"\).*?return \{\"status\": \"ok\"\}', re.DOTALL)

new_fn = '''@router.post(\"/events/{event_id}/payment-callback\")
async def event_payment_callback(event_id: str, request: Request):
    \"\"\"
    Stripe Webhook for event payments.
    \"\"\"
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature', '')

    try:
        event_obj = construct_event(payload, sig_header)
    except Exception as e:
        logger.warning(f\"Stripe event payment callback failed: {e}\")
        raise HTTPException(status_code=400, detail=\"Invalid signature or payload\")

    if event_obj[\"type\"] == \"checkout.session.completed\":
        session = event_obj[\"data\"][\"object\"]
        st_session_id = session.get(\"id\")
        transaction_id = session.get(\"payment_intent\", \"\")
        metadata = session.get(\"metadata\", {})
        order_id = metadata.get(\"payment_id\")

        if order_id:
            payment = await get_payment_by_id(order_id)
        else:
            payment = await get_payment_by_stripe_id(st_session_id)

        if payment and payment[\"status\"] != PaymentStatus.PAID:
            await mark_payment_paid(payment[\"_id\"], transaction_id)
            
            user_id = payment[\"user_id\"]
            ev_id = payment[\"event_id\"]
            existing = await get_user_participation(ev_id, user_id)
            if not existing:
                participant = await request_to_join(ev_id, user_id)
                from app.modules.participants.service import approve_participant
                await approve_participant(participant[\"_id\"])
            elif existing[\"status\"] != ParticipantStatus.APPROVED:
                from app.modules.participants.service import approve_participant
                await approve_participant(existing[\"_id\"])

            logger.info(\"Event payment %s confirmed via Stripe callback\", payment[\"_id\"])

    return {\"status\": \"ok\"}'''

text = pattern.sub(new_fn, text)

with open(r'.\backend\app\modules\payments\router.py', 'w', encoding='utf-8') as f:
    f.write(text)