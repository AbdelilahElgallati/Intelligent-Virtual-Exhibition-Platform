import stripe
from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

def create_payment_session(
    order_id: str,
    amount: float,
    product_name: str,
    buyer_email: str,
    success_url: str,
    cancel_url: str,
    metadata: dict = None,
) -> dict:
    """
    Creates a Stripe Checkout session.
    """
    try:
        session_metadata = {
            'order_id': order_id,
            'source': 'marketplace'
        }
        if metadata:
            session_metadata.update(metadata)
            
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            customer_email=buyer_email if buyer_email else None,
            line_items=[{
                'price_data': {
                    'currency': 'mad',
                    'product_data': {
                        'name': product_name,
                    },
                    'unit_amount': int(amount * 100), # Cents
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            client_reference_id=order_id,
            metadata=session_metadata
        )
        return {
            "session_id": session.id,
            "url": session.url
        }
    except Exception as e:
        raise Exception(f"Stripe error: {str(e)}")

def construct_event(payload: bytes, sig_header: str):
    """Verifies Stripe Webhook signature and returns the event."""
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )