import re

with open(r'.\backend\app\modules\payments\router.py', 'r', encoding='utf-8') as f:
    text = f.read()

added_webhook_logic = '''        source = metadata.get("source")
        
        if source == "organizer_event_fee":
            event_id = metadata.get("event_id")
            if event_id:
                from app.modules.events.service import confirm_event_payment
                await confirm_event_payment(event_id)
                logger.info("Event fee for %s confirmed via Stripe webhook", event_id)
            return {"status": "ok"}
            
        if order_id:'''

text = text.replace('        if order_id:', added_webhook_logic)

with open(r'.\backend\app\modules\payments\router.py', 'w', encoding='utf-8') as f:
    f.write(text)