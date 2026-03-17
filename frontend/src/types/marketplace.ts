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
  type: 'product' | 'service';
  created_at: string;
}

export interface ProductCreatePayload {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  image_url?: string;
  stock: number;
  type?: 'product' | 'service';
}

export interface ProductUpdatePayload {
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  image_url?: string;
  stock?: number;
  type?: 'product' | 'service';
}

export interface MarketplaceOrder {
  id: string;
  product_id: string;
  stand_id: string;
  buyer_id: string;
  product_name: string;
  quantity: number;
  unit_price?: number;
  total_amount: number;
  currency?: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  payment_method?: 'stripe' | 'cash_on_delivery';
  status: 'pending' | 'paid' | 'cancelled';
  shipping_address?: string;
  delivery_notes?: string;
  buyer_phone?: string;
  created_at: string;
  paid_at: string | null;
}

export interface CheckoutResponse {
  payment_url: string | null;
  order_id: string;
}

export interface CartItem {
  product_id: string;
  quantity: number;
}

export interface CartCheckoutResponse {
  payment_url: string | null;
  order_ids: string[];
}
