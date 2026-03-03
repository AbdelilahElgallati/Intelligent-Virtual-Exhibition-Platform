/* ─── Stand Marketplace types (isolated from event payments) ─── */

export interface Product {
  id: string;
  stand_id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  image_url: string;
  stock: number;
  created_at: string;
}

export interface ProductCreatePayload {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  image_url?: string;
  stock: number;
}

export interface ProductUpdatePayload {
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  image_url?: string;
  stock?: number;
}

export interface MarketplaceOrder {
  id: string;
  product_id: string;
  stand_id: string;
  buyer_id: string;
  product_name: string;
  quantity: number;
  total_amount: number;
  stripe_session_id: string;
  stripe_payment_intent: string;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
  paid_at: string | null;
}

export interface CheckoutResponse {
  session_url: string;
  order_id: string;
}
