import re

with open(r"backend\app\modules\payments\router.py", "r", encoding="utf-8") as f:
    content = f.read()

old_logic = """        if source == "organizer_event_fee":
            event_id = metadata.get("event_id")
            if event_id:
                from app.modules.events.service import confirm_event_payment    
                await confirm_event_payment(event_id)
                logger.info("Event fee for %s confirmed via Stripe webhook", event_id)
            return {"status": "ok"}"""

new_logic = """        if source == "enterprise_stand_fee":
            participant_id = metadata.get("participant_id")
            if participant_id:
                from app.db.mongo import get_database
                from pymongo import ReturnDocument
                from bson import ObjectId
                from app.modules.participants.schemas import ParticipantStatus
                db = get_database()
                pid = ObjectId(participant_id) if ObjectId.is_valid(participant_id) else participant_id
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
                    logger.info("Enterprise stand fee paid for participant %s", participant_id)
            return {"status": "ok"}"""

content = content.replace(old_logic, new_logic)

with open(r"backend\app\modules\payments\router.py", "w", encoding="utf-8") as f:
    f.write(content)
