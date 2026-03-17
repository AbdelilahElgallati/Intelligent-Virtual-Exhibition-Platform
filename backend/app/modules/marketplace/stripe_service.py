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
    line_items: list[dict] | None = None,
) -> dict:
    """
    Creates a Stripe Checkout session.

    If *line_items* is provided each entry must contain:
        name, unit_amount (cents), currency, quantity  (and optionally description).
    Otherwise a single line item is built from amount / product_name.
    """
    try:
        session_metadata = {
            'order_id': order_id,
            'source': 'marketplace'
        }
        if metadata:
            session_metadata.update(metadata)

        # Build Stripe line_items payload
        if line_items:
            stripe_line_items = []
            for li in line_items:
                product_data: dict = {'name': li['name']}
                if li.get('description'):
                    product_data['description'] = li['description']
                stripe_line_items.append({
                    'price_data': {
                        'currency': li.get('currency', 'mad').lower(),
                        'product_data': product_data,
                        'unit_amount': int(li['unit_amount']),
                    },
                    'quantity': int(li['quantity']),
                })
        else:
            # Fallback: single aggregated line item
            stripe_line_items = [{
                'price_data': {
                    'currency': 'mad',
                    'product_data': {'name': product_name},
                    'unit_amount': int(amount * 100),
                },
                'quantity': 1,
            }]

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            customer_email=buyer_email if buyer_email else None,
            line_items=stripe_line_items,
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