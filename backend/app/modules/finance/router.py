from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import require_role
from app.modules.audit.service import log_audit
from app.modules.auth.enums import Role
from app.modules.finance.schemas import (
    CreatePayoutRequest,
    CreatePayoutResponse,
    DeletePayoutResponse,
    FinancialTransactionListResponse,
    PayoutListResponse,
    PayoutRecord,
    UpdatePayoutRequest,
)
from app.modules.finance.service import (
    delete_payout,
    get_all_financial_transactions,
    get_financial_transaction_by_id,
    get_payout_by_id,
    list_payouts,
    settle_transaction,
    update_payout,
)

router = APIRouter(prefix="/admin/finance", tags=["Admin Finance"])


@router.get("/transactions", response_model=FinancialTransactionListResponse)
async def get_finance_transactions(
    source_type: str | None = Query(default=None),
    payout_status: str | None = Query(default=None),
    receiver_type: str | None = Query(default=None),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    allowed_source = {None, "event_ticket", "marketplace", "stand_fee"}
    allowed_payout_status = {None, "unpaid", "processing", "paid"}
    allowed_receiver_type = {None, "organizer", "enterprise", "platform"}

    if source_type not in allowed_source:
        raise HTTPException(status_code=400, detail="Invalid source_type")
    if payout_status not in allowed_payout_status:
        raise HTTPException(status_code=400, detail="Invalid payout_status")
    if receiver_type not in allowed_receiver_type:
        raise HTTPException(status_code=400, detail="Invalid receiver_type")

    items = await get_all_financial_transactions(
        source_type=source_type,
        payout_status=payout_status,
        receiver_type=receiver_type,
    )
    return FinancialTransactionListResponse(items=items, total=len(items))


@router.post("/payouts/{transaction_id}", response_model=CreatePayoutResponse)
async def mark_transaction_paid(
    transaction_id: str,
    payload: CreatePayoutRequest,
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    transaction = await get_financial_transaction_by_id(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    try:
        payout_doc, already_settled = await settle_transaction(
            transaction_id=transaction_id,
            admin_id=str(current_user.get("_id")),
            note=payload.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not already_settled:
        await log_audit(
            actor_id=str(current_user.get("_id")),
            action="finance.payout_marked_paid",
            entity="payout",
            entity_id=payout_doc.get("_id", ""),
            metadata={
                "transaction_id": transaction_id,
                "receiver_id": payout_doc.get("receiver_id"),
                "amount": payout_doc.get("amount"),
                "note": payload.note,
            },
        )

    refreshed_tx = await get_financial_transaction_by_id(transaction_id)
    if not refreshed_tx:
        raise HTTPException(status_code=500, detail="Failed to refresh transaction state")

    payout = PayoutRecord(**payout_doc)
    return CreatePayoutResponse(
        payout=payout,
        transaction=refreshed_tx,
        already_settled=already_settled,
    )


@router.get("/payouts", response_model=PayoutListResponse)
async def get_payout_history(
    _: dict = Depends(require_role(Role.ADMIN)),
):
    docs = await list_payouts()
    items = [PayoutRecord(**d) for d in docs]
    return PayoutListResponse(items=items, total=len(items))


@router.patch("/payouts/{payout_id}", response_model=PayoutRecord)
async def edit_payout_history(
    payout_id: str,
    payload: UpdatePayoutRequest,
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    existing = await get_payout_by_id(payout_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Payout record not found")

    updated = await update_payout(
        payout_id=payout_id,
        admin_id=str(current_user.get("_id")),
        note=payload.note,
        status=payload.status,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Payout record not found")

    await log_audit(
        actor_id=str(current_user.get("_id")),
        action="finance.payout_updated",
        entity="payout",
        entity_id=updated.get("_id", ""),
        metadata={
            "payout_id": updated.get("_id", ""),
            "transaction_id": updated.get("transaction_id", ""),
            "note": payload.note,
            "status": payload.status,
        },
    )

    docs = await list_payouts()
    resolved = next((d for d in docs if str(d.get("_id")) == str(updated.get("_id"))), updated)
    return PayoutRecord(**resolved)


@router.delete("/payouts/{payout_id}", response_model=DeletePayoutResponse)
async def remove_payout_history(
    payout_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    existing = await get_payout_by_id(payout_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Payout record not found")

    deleted = await delete_payout(payout_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Payout record not found")

    await log_audit(
        actor_id=str(current_user.get("_id")),
        action="finance.payout_deleted",
        entity="payout",
        entity_id=str(existing.get("_id", payout_id)),
        metadata={
            "payout_id": str(existing.get("_id", payout_id)),
            "transaction_id": existing.get("transaction_id", ""),
            "receiver_id": existing.get("receiver_id", ""),
            "amount": existing.get("amount", 0),
        },
    )

    return DeletePayoutResponse(deleted=True, payout_id=str(existing.get("_id", payout_id)))
