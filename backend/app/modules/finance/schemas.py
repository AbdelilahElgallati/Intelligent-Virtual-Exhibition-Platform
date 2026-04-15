from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


SourceType = Literal["event_ticket", "marketplace", "stand_fee"]
ReceiverType = Literal["organizer", "enterprise", "platform"]
TransactionStatus = Literal["paid", "pending", "failed"]
PayoutStatus = Literal["unpaid", "processing", "paid"]
PayoutRecordStatus = Literal["pending", "completed"]


class FinancialTransaction(BaseModel):
    id: str
    source_type: SourceType
    reference_id: str
    amount: float
    currency: str
    payer_id: str
    receiver_type: ReceiverType
    receiver_id: str
    status: TransactionStatus
    payout_status: PayoutStatus = "unpaid"
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    description: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class FinancialTransactionListResponse(BaseModel):
    items: list[FinancialTransaction]
    total: int


class CreatePayoutRequest(BaseModel):
    note: Optional[str] = None


class PayoutRecord(BaseModel):
    id: str = Field(alias="_id")
    transaction_id: str
    receiver_id: str
    receiver_name: Optional[str] = None
    amount: float
    status: PayoutRecordStatus
    note: Optional[str] = None
    processed_by: str
    processed_by_name: Optional[str] = None
    processed_at: datetime

    model_config = {"populate_by_name": True}


class PayoutListResponse(BaseModel):
    items: list[PayoutRecord]
    total: int


class CreatePayoutResponse(BaseModel):
    payout: PayoutRecord
    transaction: FinancialTransaction
    already_settled: bool = False


class UpdatePayoutRequest(BaseModel):
    note: Optional[str] = None
    status: Optional[PayoutRecordStatus] = None


class DeletePayoutResponse(BaseModel):
    deleted: bool
    payout_id: str
