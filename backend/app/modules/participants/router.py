"""
Participants module router for IVEP.

Handles participant invitations and join requests.
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user, require_roles
from app.modules.auth.enums import Role
from app.modules.events.service import get_event_by_id
from app.modules.notifications.schemas import NotificationType
from app.modules.notifications.service import create_notification
from app.modules.participants.schemas import (
    ParticipantRead,
    ParticipantStatus,
    RejectRequest,
    EnrichedParticipantRead,
)
from app.modules.participants.service import (
    approve_participant,
    get_participant_by_id,
    get_user_participation,
    invite_participant,
    list_event_attendees,
    list_event_participants,
    reject_participant_with_reason,
    request_to_join,
)
from app.modules.audit.service import log_audit


router = APIRouter(prefix="/participants/event/{event_id}", tags=["Participants"])


class InviteRequest(BaseModel):
    """Schema for inviting a participant."""
    user_id: str


@router.post("/invite", response_model=ParticipantRead, status_code=status.HTTP_201_CREATED)
async def invite_user_to_event(
    event_id: str,
    request: InviteRequest,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> ParticipantRead:
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    existing = await get_user_participation(event_id, request.user_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already has a participation record")

    participant = await invite_participant(event_id, request.user_id)

    await create_notification(
        user_id=request.user_id,
        type=NotificationType.INVITATION_SENT,
        message=f"You have been invited to event '{event['title']}'.",
    )

    return ParticipantRead(**participant)


@router.post("/request", response_model=ParticipantRead, status_code=status.HTTP_201_CREATED)
async def request_to_join_event(
    event_id: str,
    current_user: dict = Depends(require_roles([Role.VISITOR, Role.ENTERPRISE])),
) -> ParticipantRead:
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    existing = await get_user_participation(event_id, current_user["_id"])
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already have a participation record")

    participant = await request_to_join(event_id, current_user["_id"])
    return ParticipantRead(**participant)


@router.post("/{participant_id}/approve", response_model=ParticipantRead)
async def approve_event_participant(
    event_id: str,
    participant_id: str,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> ParticipantRead:
    event = await get_event_by_id(event_id)
    if event is None:
        print(f"DEBUG: Event {event_id} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    participant = await get_participant_by_id(participant_id)
    if participant is None:
        print(f"DEBUG: Participant {participant_id} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")

    if str(participant.get("event_id")) != str(event_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Participant does not belong to this event")

    is_enterprise_participant = (participant.get("role") == Role.ENTERPRISE.value)
    target_status = ParticipantStatus.PENDING_PAYMENT.value if is_enterprise_participant else ParticipantStatus.APPROVED.value
    updated = await approve_participant(participant_id, target_status=target_status)

    if is_enterprise_participant:
        message = f"Your request to join '{event['title']}' has been approved. Please pay the stand fee to activate access."
    else:
        message = f"Your request to join '{event['title']}' has been approved."

    await create_notification(
        user_id=participant["user_id"],
        type=NotificationType.PARTICIPANT_ACCEPTED,
        message=message,
    )

    # Audit log
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="enterprise.approve",
        entity="participant",
        entity_id=participant_id,
        metadata={
            "event_id": event_id,
            "enterprise_user_id": participant.get("user_id"),
        },
    )

    return ParticipantRead(**updated)


@router.post("/{participant_id}/reject", response_model=ParticipantRead)
async def reject_event_participant(
    event_id: str,
    participant_id: str,
    body: RejectRequest = RejectRequest(),
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> ParticipantRead:
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    participant = await get_participant_by_id(participant_id)
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")

    if str(participant.get("event_id")) != str(event_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Participant does not belong to this event")

    updated = await reject_participant_with_reason(participant_id, reason=body.reason)

    # Audit log
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="enterprise.reject",
        entity="participant",
        entity_id=participant_id,
        metadata={
            "event_id": event_id,
            "enterprise_user_id": participant.get("user_id"),
            "reason": body.reason,
        },
    )

    return ParticipantRead(**updated)


@router.get("/", response_model=list[ParticipantRead])
async def get_event_participants(
    event_id: str,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> list[ParticipantRead]:
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    participants = await list_event_participants(event_id)
    return [ParticipantRead(**p) for p in participants]

@router.get("/attendees")
async def get_event_attendees(
    event_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Public endpoint: list approved participants with profile info for networking."""
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return await list_event_attendees(event_id)

@router.get("/enterprises", response_model=list[EnrichedParticipantRead])
async def get_event_enterprise_participants(
    event_id: str,
    current_user: dict = Depends(require_roles([Role.ENTERPRISE, Role.ADMIN, Role.ORGANIZER, Role.VISITOR])),
) -> list[EnrichedParticipantRead]:
    """
    Allow enterprises to see other approved participants of the same event for B2B discovery.
    """
    from app.modules.participants.service import get_participants_collection
    from app.db.utils import stringify_object_ids
    from app.db.mongo import get_database
    from bson import ObjectId

    collection = get_participants_collection()
    db = get_database()
    org_members_col = db["organization_members"]
    organizations_col = db["organizations"]
    users_col = db["users"]

    # Only approved enterprises
    cursor = collection.find({
        "event_id": str(event_id),
        "status": ParticipantStatus.APPROVED.value
    })
    docs = await cursor.to_list(length=1000)
    
    enriched = []
    for doc in docs:
        user_id = doc.get("user_id")
        
        # Don't include the current enterprise in the B2B list (skip for organizers/admins)
        if str(user_id) == str(current_user["_id"]):
            continue
            
        # Verify the user is actually an enterprise
        try:
            uid_str = str(user_id)
            uid_obj = ObjectId(uid_str) if ObjectId.is_valid(uid_str) else None
            
            user_doc = None
            if uid_obj:
                user_doc = await users_col.find_one({"_id": uid_obj})
            if not user_doc:
                user_doc = await users_col.find_one({"_id": uid_str})
            if not user_doc:
                user_doc = await users_col.find_one({"id": uid_str})
                
            if not user_doc:
                continue
                
            role = user_doc.get("role")
            if hasattr(role, "value"):
                role = role.value
            role_str = str(role).lower() if role else ""
            if role_str != "enterprise":
                continue
        except Exception as e:
            print(f"Error verifying enterprise role for {user_id}: {e}")
            continue
            
        # Try to find their organization
        organization_name = "Unknown Enterprise"
        organization_id = doc.get("organization_id")
        
        if not organization_id:
            # Fallback to org_members lookup
            member_doc = await org_members_col.find_one({"user_id": str(user_id)})
            if member_doc:
                organization_id = member_doc.get("organization_id")
        
        org_doc = None
        if organization_id:
            organization_id = str(organization_id)
            try:
                query = {"$or": [
                    {"_id": ObjectId(organization_id) if ObjectId.is_valid(organization_id) else None},
                    {"id": organization_id},
                    {"_id": organization_id}
                ]}
                actual_query = [q for q in query["$or"] if q[list(q.keys())[0]] is not None]
                org_doc = await organizations_col.find_one({"$or": actual_query})
            except Exception as e:
                print(f"Error fetching org by ID for {organization_id}: {e}")

        if not org_doc:
            # Try lookup via owner_id since we know the user_id
            try:
                org_doc = await organizations_col.find_one({"owner_id": str(user_id)})
            except Exception:
                pass

        if org_doc:
            organization_name = org_doc.get("name", organization_name)
            organization_id = str(org_doc.get("_id", org_doc.get("id")))
        organization_description = org_doc.get("description") if org_doc else None
        organization_industry = org_doc.get("industry") if org_doc else None
        organization_website = org_doc.get("website") if org_doc else None
        organization_logo_url = org_doc.get("logo_url") if org_doc else None
        organization_contact_email = org_doc.get("contact_email") if org_doc else None
        organization_contact_phone = org_doc.get("contact_phone") if org_doc else None
        organization_city = (org_doc.get("city") if org_doc else None) or user_doc.get("org_city")
        organization_country = (org_doc.get("country") if org_doc else None) or user_doc.get("org_country")
        
        # Find stand_id for this participant
        stand_id = None
        if organization_id:
            from app.modules.stands.service import get_stand_by_org
            stand_doc = await get_stand_by_org(str(event_id), organization_id)
            if stand_doc:
                stand_id = str(stand_doc.get("_id", stand_doc.get("id")))

        # Construct explicitly to ensure No PII leakage
        try:
            enriched_item = EnrichedParticipantRead(
                id=str(doc["_id"]),
                event_id=str(event_id),
                user_id=str(user_id),
                status=doc.get("status", ParticipantStatus.APPROVED.value),
                role="enterprise",
                created_at=doc.get("created_at", datetime.now(timezone.utc)),
                organization_id=organization_id,
                organization_name=organization_name,
                stand_id=stand_id,
                description=organization_description,
                industry=organization_industry,
                website=organization_website,
                logo_url=organization_logo_url,
                contact_email=organization_contact_email,
                contact_phone=organization_contact_phone,
                location_city=organization_city,
                location_country=organization_country,
            )
            enriched.append(enriched_item)
        except Exception as e:
            print(f"Error constructing EnrichedParticipantRead for {user_id}: {e}")
            continue
        
    return enriched