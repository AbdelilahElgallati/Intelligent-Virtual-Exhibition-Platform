"""
Stripe webhook handler with idempotency and security checks.
Handles payment events safely to prevent double-charging and race conditions.
"""

import logging
import stripe
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from bson import ObjectId
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


class StripeWebhookHandler:
    """
    Secure Stripe webhook event processor with idempotency.
    """
    
    def __init__(self, db):
        self.db = db
        self.processed_events_collection = db.stripe_webhook_events
    
    async def ensure_indices(self):
        """Create indices for webhook tracking."""
        await self.processed_events_collection.create_index(
            "event_id",
            unique=True,
            sparse=True
        )
        # TTL index: auto-delete after 90 days
        await self.processed_events_collection.create_index(
            "created_at",
            expireAfterSeconds=7776000  # 90 days
        )
    
    async def is_event_processed(self, event_id: str) -> bool:
        """Check if webhook event already processed (idempotency)."""
        existing = await self.processed_events_collection.find_one({
            "event_id": event_id
        })
        return existing is not None
    
    async def mark_event_processed(self, event_id: str, event_data: Dict[str, Any]) -> None:
        """Record processed webhook event."""
        await self.processed_events_collection.insert_one({
            "event_id": event_id,
            "event_type": event_data.get("type"),
            "data": event_data,
            "processed_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
        })
        logger.info(f"✓ Webhook event recorded: {event_id}")
    
    async def validate_webhook_signature(
        self,
        payload: bytes,
        sig_header: str,
        webhook_secret: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Validate webhook signature against Stripe secret.
        
        Args:
            payload: Raw request body
            sig_header: Stripe signature header
            webhook_secret: Webhook secret from Stripe
        
        Returns:
            Parsed event dict if valid, None if invalid
        """
        try:
            event = stripe.Webhook.construct_event(
                payload,
                sig_header,
                webhook_secret
            )
            return event
        except ValueError as e:
            logger.error(f"Invalid webhook payload: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request body"
            )
        except stripe.error.SignatureVerificationError as e:
            logger.warning(f"Invalid webhook signature: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid signature"
            )
    
    async def process_payment_succeeded(self, event: Dict[str, Any]) -> None:
        """
        Process payment.charge.succeeded or payment_intent.succeeded event.
        
        This is the safe place to:
        1. Mark orders as paid
        2. Create participant records
        3. Send confirmation emails
        """
        data = event.get("data", {}).get("object", {})
        metadata = data.get("metadata", {})
        
        # Validate metadata
        order_id = metadata.get("order_id")
        event_id = metadata.get("event_id")
        user_id = metadata.get("user_id")
        
        if not all([order_id, event_id, user_id]):
            logger.warning(f"Incomplete metadata in payment: {metadata}")
            return
        
        # Verify order exists and is unpaid
        try:
            order = await self.db.orders.find_one_and_update(
                {
                    "_id": ObjectId(order_id),
                    "status": "pending",  # Only mark if still pending
                    "event_id": ObjectId(event_id),
                },
                {
                    "$set": {
                        "status": "paid",
                        "paid_at": datetime.now(timezone.utc),
                        "stripe_payment_id": data.get("id"),
                    }
                },
                return_document=True
            )
            
            if not order:
                logger.warning(f"Order not found or already processed: {order_id}")
                return
            
            logger.info(f"✓ Order marked as paid: {order_id}")
            
            # Create participant record if not exists
            existing_participant = await self.db.participants.find_one({
                "event_id": ObjectId(event_id),
                "user_id": ObjectId(user_id),
            })
            
            if not existing_participant:
                participant = {
                    "event_id": ObjectId(event_id),
                    "user_id": ObjectId(user_id),
                    "status": "registered",
                    "registered_at": datetime.now(timezone.utc),
                    "tickets": order.get("tickets", 1),
                    "order_id": ObjectId(order_id),
                }
                result = await self.db.participants.insert_one(participant)
                logger.info(f"✓ Participant created: {result.inserted_id}")
            
        except Exception as e:
            logger.error(f"Error processing payment: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process payment"
            )
    
    async def process_payment_failed(self, event: Dict[str, Any]) -> None:
        """Process payment failure event."""
        data = event.get("data", {}).get("object", {})
        metadata = data.get("metadata", {})
        order_id = metadata.get("order_id")
        
        if order_id:
            try:
                await self.db.orders.update_one(
                    {"_id": ObjectId(order_id)},
                    {
                        "$set": {
                            "status": "failed",
                            "failed_at": datetime.now(timezone.utc),
                            "failure_reason": data.get("failure_message", "Unknown error"),
                        }
                    }
                )
                logger.info(f"Order marked as failed: {order_id}")
            except Exception as e:
                logger.error(f"Error marking payment failed: {str(e)}")
    
    async def process_charge_refunded(self, event: Dict[str, Any]) -> None:
        """Process refund event."""
        data = event.get("data", {}).get("object", {})
        metadata = data.get("metadata", {})
        order_id = metadata.get("order_id")
        
        if order_id:
            try:
                await self.db.orders.update_one(
                    {"_id": ObjectId(order_id)},
                    {
                        "$set": {
                            "status": "refunded",
                            "refunded_at": datetime.now(timezone.utc),
                            "refund_amount": data.get("amount_refunded"),
                        }
                    }
                )
                logger.info(f"Order refunded: {order_id}")
            except Exception as e:
                logger.error(f"Error processing refund: {str(e)}")
