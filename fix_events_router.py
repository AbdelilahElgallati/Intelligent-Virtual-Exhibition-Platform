import re

with open(r'.\backend\app\modules\events\router.py', 'r', encoding='utf-8') as f:
    text = f.read()

new_ep = '''@router.post(\"/{event_id}/organizer-checkout\")
async def create_organizer_checkout(
    event_id: str,
    request: Request,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    \"\"\"
    Create a Stripe payment session for the enterprise to pay the event fee.
    \"\"\"
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=\"Event not found\")
        
    if event[\"organizer_id\"] != str(current_user[\"_id\"]):
        raise HTTPException(status_code=403, detail=\"Not authorized\")

    if event[\"state\"] != EventState.WAITING_FOR_PAYMENT:
        raise HTTPException(status_code=400, detail=\"Event is not waiting for payment\")

    fee_amount = event.get(\"payment_amount\", 1000.0) # default or from event
    if fee_amount <= 0:
        raise HTTPException(status_code=400, detail=\"No payment required or invalid amount\")

    origin = request.headers.get(\"origin\") or request.headers.get(\"referer\") or \"http://localhost:3000\"
    origin = origin.rstrip(\"/\")
    success_url = f\"{origin}/dashboard/events\"
    cancel_url = f\"{origin}/dashboard/events\"

    from app.modules.marketplace.stripe_service import create_payment_session
    try:
        st_result = create_payment_session(
            order_id=event_id,
            amount=fee_amount,
            product_name=f\"Event Fee: {event.get('title', 'Unknown')}\",
            success_url=success_url,
            cancel_url=cancel_url,
            buyer_email=current_user.get(\"email\", \"\"),
            metadata={
                \"event_id\": event_id,
                \"source\": \"organizer_event_fee\"
            }
        )
        return {\"payment_url\": st_result[\"url\"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f\"Stripe error: {e}\")

@router.post(\"/{event_id}/submit-proof\", response_model=EventRead)'''

text = text.replace('@router.post(\"/{event_id}/submit-proof\", response_model=EventRead)', new_ep)

with open(r'.\backend\app\modules\events\router.py', 'w', encoding='utf-8') as f:
    f.write(text)