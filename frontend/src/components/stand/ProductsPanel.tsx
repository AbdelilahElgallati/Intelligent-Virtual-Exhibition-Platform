'use client';

<<<<<<< HEAD
import React, { useEffect, useState } from 'react';
import { X, ShoppingBag, Package, Minus, Plus, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Product, CheckoutResponse } from '@/types/marketplace';
=======
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, ShoppingBag, ShoppingCart, Package, Minus, Plus, Loader2, Trash2, AlertCircle, Briefcase } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { resolveMediaUrl } from '@/lib/media';
import { downloadMarketplaceUnifiedOrderReceiptPdf } from '@/lib/pdf/receipts';
import { loadEventReceiptContext } from '@/lib/pdf/eventReceiptContext';
import type { Product, CartCheckoutResponse, UnifiedMarketplaceOrder } from '@/types/marketplace';
>>>>>>> eb6221363e02667d615fd22792910b75ec97f750

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
interface ProductsPanelProps {
    standId: string;
    standName: string;
    themeColor?: string;
    onClose: () => void;
}

/* ------------------------------------------------------------------ */
<<<<<<< HEAD
/*  ProductsPanel                                                      */
=======
/*  Cart item type                                                     */
/* ------------------------------------------------------------------ */
interface CartEntry {
    product: Product;
    quantity: number;
}

const isServiceProduct = (product: Product) => (product.type || 'product') === 'service';

/* ------------------------------------------------------------------ */
/*  ProductsPanel (centered modal with cart)                           */
>>>>>>> eb6221363e02667d615fd22792910b75ec97f750
/* ------------------------------------------------------------------ */
export function ProductsPanel({ standId, standName, themeColor = '#4f46e5', onClose }: ProductsPanelProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
<<<<<<< HEAD
    const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
=======
    const [cart, setCart] = useState<Record<string, CartEntry>>({});
    const [checkingOut, setCheckingOut] = useState(false);
    const [view, setView] = useState<'products' | 'cart'>('products');
    const [activeTab, setActiveTab] = useState<'product' | 'service'>('product');
    const [shippingAddress, setShippingAddress] = useState('');
    const [deliveryNotes, setDeliveryNotes] = useState('');
    const [buyerPhone, setBuyerPhone] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'cash_on_delivery'>('stripe');
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [placedOrderIds, setPlacedOrderIds] = useState<string[]>([]);
    const [placedCheckoutGroupId, setPlacedCheckoutGroupId] = useState<string | null>(null);
    const [validationToast, setValidationToast] = useState<string | null>(null);
    const deliveryInfoRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!validationToast) return;
        const t = window.setTimeout(() => setValidationToast(null), 3200);
        return () => window.clearTimeout(t);
    }, [validationToast]);
>>>>>>> eb6221363e02667d615fd22792910b75ec97f750

    /* ---- Fetch products ---- */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await apiClient.get<Product[]>(ENDPOINTS.MARKETPLACE.PRODUCTS(standId));
                if (!cancelled) setProducts(data);
            } catch (err: any) {
                if (!cancelled) setError(err?.message || 'Failed to load products');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [standId]);

<<<<<<< HEAD
    /* ---- Quantity helpers ---- */
    const getQty = (id: string) => quantities[id] ?? 1;

    const setQty = (id: string, val: number, max: number) => {
        setQuantities((prev) => ({ ...prev, [id]: Math.max(1, Math.min(val, max, 100)) }));
    };

    /* ---- Checkout ---- */
    const handleCheckout = async (product: Product) => {
        const qty = getQty(product.id);
        setCheckoutLoadingId(product.id);
        try {
            const resp = await apiClient.post<CheckoutResponse>(
                ENDPOINTS.MARKETPLACE.CHECKOUT(standId, product.id),
                { quantity: qty },
            );
            // Redirect browser to Stripe Checkout
            window.location.href = resp.session_url;
        } catch (err: any) {
            alert(err?.message || 'Checkout failed. Please try again.');
        } finally {
            setCheckoutLoadingId(null);
=======
    /* ---- Filter by tab ---- */
    const filteredProducts = products.filter((p) => (p.type || 'product') === activeTab);

    /* ---- Cart helpers ---- */
    const cartItems = Object.values(cart);
    const cartCount = cartItems.reduce((sum, c) => sum + c.quantity, 0);
    const cartTotal = cartItems.reduce((sum, c) => sum + c.product.price * c.quantity, 0);

    const addToCart = useCallback((product: Product) => {
        setCart((prev) => {
            if (isServiceProduct(product)) {
                return { ...prev, [product.id]: { product, quantity: 1 } };
            }
            const existing = prev[product.id];
            const currentQty = existing ? existing.quantity : 0;
            if (!isServiceProduct(product) && currentQty >= product.stock) return prev;
            return { ...prev, [product.id]: { product, quantity: currentQty + 1 } };
        });
    }, []);

    const updateCartQty = useCallback((productId: string, qty: number) => {
        setCart((prev) => {
            const entry = prev[productId];
            if (!entry) return prev;
            if (isServiceProduct(entry.product)) {
                return { ...prev, [productId]: { ...entry, quantity: 1 } };
            }
            const maxQty = isServiceProduct(entry.product) ? 100 : Math.min(entry.product.stock, 100);
            const clamped = Math.max(0, Math.min(qty, maxQty));
            if (clamped <= 0) {
                const { [productId]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [productId]: { ...entry, quantity: clamped } };
        });
    }, []);

    const removeFromCart = useCallback((productId: string) => {
        setCart((prev) => {
            const { [productId]: _, ...rest } = prev;
            return rest;
        });
    }, []);

    /* ---- Cart checkout ---- */
    const handleCartCheckout = async () => {
        if (cartItems.length === 0) return;
        const shipping = shippingAddress.trim();
        const phone = buyerPhone.trim();
        const notes = deliveryNotes.trim();
        if (!shipping || !phone || !notes) {
            setView('cart');
            setValidationToast('Please fill all required delivery information fields.');
            window.setTimeout(() => {
                deliveryInfoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
            return;
        }

        setCheckingOut(true);
        try {
            const items = cartItems.map((c) => ({
                product_id: c.product.id,
                quantity: isServiceProduct(c.product) ? 1 : c.quantity,
            }));
            const resp = await apiClient.post<CartCheckoutResponse>(
                ENDPOINTS.MARKETPLACE.CART_CHECKOUT(standId),
                {
                    items,
                    shipping_address: shipping,
                    delivery_notes: notes,
                    buyer_phone: phone,
                    payment_method: paymentMethod,
                },
            );
            if (resp.payment_url) {
                window.location.href = resp.payment_url;
            } else {
                // Cash on delivery or other direct completion
                setPlacedOrderIds(Array.isArray(resp.order_ids) ? resp.order_ids : []);
                setPlacedCheckoutGroupId(resp.checkout_group_id || null);
                setCart({});
                setOrderSuccess(true);
            }
        } catch (err: any) {
            alert(err?.message || 'Checkout failed. Please try again.');
        } finally {
            setCheckingOut(false);
>>>>>>> eb6221363e02667d615fd22792910b75ec97f750
        }
    };

    /* ---- Currency formatting ---- */
<<<<<<< HEAD
    const fmt = (amount: number, currency: string) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full sm:w-[480px] h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ backgroundColor: `${themeColor}08` }}>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl" style={{ backgroundColor: `${themeColor}15` }}>
                            <ShoppingBag className="w-5 h-5" style={{ color: themeColor }} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Products</h2>
                            <p className="text-xs text-gray-500 truncate max-w-[220px]">{standName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
=======
    const fmt = (amount: number) =>
        new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);

    const downloadReceipt = async () => {
        if (!placedCheckoutGroupId && placedOrderIds.length === 0) {
            alert('No order receipt available yet.');
            return;
        }

        let unifiedOrders: UnifiedMarketplaceOrder[] = [];
        try {
            if (placedCheckoutGroupId) {
                unifiedOrders = await apiClient.get<UnifiedMarketplaceOrder[]>(
                    ENDPOINTS.MARKETPLACE.UNIFIED_ORDERS_BY_GROUP(placedCheckoutGroupId)
                );
            }
        } catch {
            unifiedOrders = [];
        }

        const targetOrder = unifiedOrders[0];
        if (!targetOrder) {
            alert('Unable to fetch receipt details. Please try again later.');
            return;
        }

        const [me, ctx] = await Promise.all([
            apiClient.get<any>(ENDPOINTS.USERS.ME).catch(() => null),
            loadEventReceiptContext(targetOrder.event_id),
        ]);

        const stamp = new Date(targetOrder.created_at);
        const y = Number.isNaN(stamp.getTime()) ? '0000' : String(stamp.getFullYear());
        const m = Number.isNaN(stamp.getTime()) ? '00' : String(stamp.getMonth() + 1).padStart(2, '0');
        const d = Number.isNaN(stamp.getTime()) ? '00' : String(stamp.getDate()).padStart(2, '0');
        const token = targetOrder.group_id.replaceAll(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'UNKNOWN';
        const orderReference = `ORD-${y}${m}${d}-${token}`;

        await downloadMarketplaceUnifiedOrderReceiptPdf({
            groupId: targetOrder.group_id,
            orderReference,
            standName: targetOrder.stand_name,
            paymentMethod: targetOrder.payment_method,
            status: targetOrder.status,
            buyerName: me?.full_name || me?.username || me?.email || 'Visitor',
            buyerEmail: me?.email,
            buyerPhone: targetOrder.buyer_phone,
            shippingAddress: targetOrder.shipping_address,
            deliveryNotes: targetOrder.delivery_notes,
            createdAt: targetOrder.created_at,
            paidAt: targetOrder.paid_at || undefined,
            eventId: targetOrder.event_id,
            standId: targetOrder.stand_id,
            sellerEnterpriseName: targetOrder.stand_name,
            eventTitle: ctx?.eventTitle,
            eventLocation: ctx?.eventLocation,
            eventTimezone: ctx?.eventTimezone,
            items: targetOrder.items.map((item) => ({
                product_name: item.product_name,
                product_type: item.product_type,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_amount: item.total_amount,
                currency: item.currency,
            })),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with heavy blur */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-[95%] sm:max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-white/70 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300 transform-gpu">
                {validationToast && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-md rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-xs font-semibold text-red-700 shadow-lg">
                        {validationToast}
                    </div>
                )}

                {/* ---- Header ---- */}
                <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl border border-gray-200" style={{ backgroundColor: `${themeColor}12` }}>
                            <ShoppingBag className="w-5 h-5" style={{ color: themeColor }} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 leading-none mb-1">
                                {view === 'products' ? (activeTab === 'product' ? 'Store' : 'Specialized Services') : 'Checkout Cart'}
                            </h2>
                            <p className="text-[11px] font-medium text-gray-500 truncate max-w-[280px]">{standName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Cart toggle button */}
                        <button
                            onClick={() => setView(view === 'products' ? 'cart' : 'products')}
                            className="relative inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-[11px] font-semibold transition-all border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-95"
                            style={view === 'cart' ? { backgroundColor: themeColor, borderColor: themeColor, color: 'white' } : { backgroundColor: 'white/60' }}
                        >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{view === 'products' ? 'My Cart' : 'Browse Store'}</span>
                            {cartCount > 0 && (
                                <span
                                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-semibold text-white px-1 shadow-md"
                                    style={{ backgroundColor: view === 'cart' ? 'black' : themeColor }}
                                >
                                    {cartCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-black/5 text-gray-400 hover:text-gray-900 transition-all active:scale-90"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ---- Body ---- */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6">
>>>>>>> eb6221363e02667d615fd22792910b75ec97f750
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <Loader2 className="w-7 h-7 animate-spin mb-2" />
                            <p className="text-sm">Loading products…</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

<<<<<<< HEAD
                    {!loading && !error && products.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <Package className="w-10 h-10 mb-3 text-gray-300" />
                            <p className="text-sm font-medium text-gray-500">No products yet</p>
                            <p className="text-xs text-gray-400 mt-1">This stand hasn't listed any products.</p>
                        </div>
                    )}

                    {products.map((product) => {
                        const qty = getQty(product.id);
                        const outOfStock = product.stock <= 0;
                        const isCheckingOut = checkoutLoadingId === product.id;

                        return (
                            <div
                                key={product.id}
                                className="rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                            >
                                {/* Product image */}
                                {product.image_url && (
                                    <div className="relative w-full h-44 bg-gray-100">
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                            draggable={false}
                                        />
                                    </div>
                                )}

                                <div className="p-4">
                                    {/* Name & price */}
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">
                                            {product.name}
                                        </h3>
                                        <span
                                            className="shrink-0 text-sm font-bold"
                                            style={{ color: themeColor }}
                                        >
                                            {fmt(product.price, product.currency)}
                                        </span>
                                    </div>

                                    {/* Description */}
                                    {product.description && (
                                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mb-3">
                                            {product.description}
                                        </p>
                                    )}

                                    {/* Stock badge */}
                                    <div className="mb-3">
                                        {outOfStock ? (
                                            <span className="inline-block px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-semibold">
                                                Out of Stock
                                            </span>
                                        ) : (
                                            <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-semibold">
                                                {product.stock} in stock
                                            </span>
                                        )}
                                    </div>

                                    {/* Quantity + Buy */}
                                    {!outOfStock && (
                                        <div className="flex items-center gap-3">
                                            {/* Qty selector */}
                                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                                <button
                                                    onClick={() => setQty(product.id, qty - 1, product.stock)}
                                                    className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
                                                    disabled={qty <= 1 || isCheckingOut}
                                                >
                                                    <Minus className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="px-3 py-1.5 text-xs font-semibold text-gray-800 min-w-[32px] text-center bg-gray-50/50">
                                                    {qty}
                                                </span>
                                                <button
                                                    onClick={() => setQty(product.id, qty + 1, product.stock)}
                                                    className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
                                                    disabled={qty >= product.stock || isCheckingOut}
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {/* Buy button */}
                                            <button
                                                onClick={() => handleCheckout(product)}
                                                disabled={isCheckingOut}
                                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-all disabled:opacity-60"
                                                style={{ backgroundColor: themeColor }}
                                            >
                                                {isCheckingOut ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Processing…
                                                    </>
                                                ) : (
                                                    <>
                                                        <ExternalLink className="w-4 h-4" />
                                                        Buy · {fmt(product.price * qty, product.currency)}
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
=======
                    {/* ====== PRODUCTS VIEW ====== */}
                    {!loading && !error && view === 'products' && (
                        <>
                            {/* Tab toggle */}
                                <div className="flex gap-2 mb-8 bg-gray-100 p-1.5 rounded-xl w-fit border border-gray-200">
                                <button
                                    onClick={() => setActiveTab('product')}
                                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'product'
                                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <Package className="w-3.5 h-3.5" />
                                    Products
                                </button>
                                <button
                                    onClick={() => setActiveTab('service')}
                                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'service'
                                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <Briefcase className="w-3.5 h-3.5" />
                                    Services
                                </button>
                            </div>

                            {filteredProducts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    {activeTab === 'service' ? <Briefcase className="w-12 h-12 mb-4 text-gray-200" /> : <Package className="w-12 h-12 mb-4 text-gray-200" />}
                                    <p className="text-xs font-semibold text-gray-500">No {activeTab}s available</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredProducts.map((product) => {
                                        const inCart = cart[product.id]?.quantity ?? 0;
                                        const isService = isServiceProduct(product);
                                        const outOfStock = !isService && product.stock <= 0;

                                        return (
                                            <div
                                                key={product.id}
                                                className="group relative flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                                            >
                                                {/* Product image */}
                                                <div className="relative w-full h-44 bg-gray-50 overflow-hidden">
                                                    <img
                                                        src={resolveMediaUrl(product.image_url) || '/stands/office-bg.jpg'}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                        draggable={false}
                                                        onError={(e) => {
                                                            e.currentTarget.src = '/stands/office-bg.jpg';
                                                        }}
                                                    />
                                                    {inCart > 0 && (
                                                        <div
                                                            className="absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-semibold text-white shadow-md animate-in zoom-in"
                                                            style={{ backgroundColor: themeColor }}
                                                        >
                                                            {inCart} IN CART
                                                        </div>
                                                    )}
                                                    {isService && (
                                                        <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-amber-500 text-white text-[10px] font-semibold shadow-md">
                                                            Service
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-6 flex-1 flex flex-col">
                                                    <div className="flex items-start justify-between gap-3 mb-2">
                                                        <h3 className="text-sm font-semibold text-gray-900 tracking-tight leading-snug line-clamp-2">
                                                            {product.name}
                                                        </h3>
                                                        <div
                                                            className="shrink-0 text-sm font-semibold"
                                                            style={{ color: themeColor }}
                                                        >
                                                            {fmt(product.price)}
                                                        </div>
                                                    </div>

                                                    {product.description && (
                                                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4">
                                                            {product.description}
                                                        </p>
                                                    )}

                                                    <div className="mt-auto pt-4 flex flex-col gap-4 border-t border-black/5">
                                                        {!isService && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-medium text-gray-500">Availability</span>
                                                                {outOfStock ? (
                                                                    <span className="text-[10px] font-semibold text-red-500">Sold Out</span>
                                                                ) : (
                                                                    <span className="text-[10px] font-semibold text-emerald-500">{product.stock} Units</span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {!outOfStock && (
                                                            <button
                                                                onClick={() => addToCart(product)}
                                                                disabled={!isService && inCart >= product.stock}
                                                                className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-white text-xs font-semibold shadow-lg transition-all duration-300 transform-gpu active:scale-95 disabled:opacity-30 hover:brightness-110"
                                                                style={{
                                                                    backgroundColor: themeColor,
                                                                    boxShadow: `0 8px 24px -6px ${themeColor}88`
                                                                }}
                                                            >
                                                                <ShoppingCart className="w-4 h-4" />
                                                                {inCart > 0 ? 'Add Another' : 'Add to Cart'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* ====== CART VIEW ====== */}
                    {!loading && !error && view === 'cart' && (
                        <>
                            {orderSuccess ? (
                                <div className="flex flex-col items-center justify-center py-20 text-emerald-600">
                                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                                        <Package className="w-8 h-8 text-emerald-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Order Placed Successfully!</h3>
                                    <p className="text-sm text-gray-500 text-center max-w-md">
                                        Your order has been received. You will pay for it on reception.
                                    </p>
                                    <button
                                        onClick={downloadReceipt}
                                        className="mt-4 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                                    >
                                        Download Receipt
                                    </button>
                                    <button
                                        onClick={() => {
                                            setOrderSuccess(false);
                                            setView('products');
                                            setPlacedCheckoutGroupId(null);
                                        }}
                                        className="mt-6 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors"
                                    >
                                        Continue Shopping
                                    </button>
                                </div>
                            ) : cartItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                    <ShoppingCart className="w-10 h-10 mb-3 text-gray-300" />
                                    <p className="text-sm font-medium text-gray-500">Your cart is empty</p>
                                    <p className="text-xs text-gray-400 mt-1">Browse products and add items to your cart.</p>
                                    <button
                                        onClick={() => setView('products')}
                                        className="mt-4 px-4 py-2 text-sm font-medium rounded-xl text-white"
                                        style={{ backgroundColor: themeColor }}
                                    >
                                        Browse Products
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Cart items */}
                                    <div className="space-y-4">
                                        {cartItems.map(({ product, quantity }) => (
                                            <div
                                                key={product.id}
                                                className="flex gap-6 p-6 rounded-2xl bg-white border border-gray-200 shadow-sm transition-all duration-300"
                                            >
                                                {/* Thumbnail */}
                                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-black/5 shrink-0 shadow-inner">
                                                    <img
                                                        src={resolveMediaUrl(product.image_url) || '/stands/office-bg.jpg'}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                        draggable={false}
                                                        onError={(e) => {
                                                            e.currentTarget.src = '/stands/office-bg.jpg';
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <div className="flex items-start justify-between gap-4 mb-1">
                                                        <h4 className="text-sm font-semibold text-gray-900 tracking-tight line-clamp-1">
                                                            {product.name}
                                                        </h4>
                                                        <button
                                                            onClick={() => removeFromCart(product.id)}
                                                            className="p-2 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all active:scale-90 shrink-0"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <p className="text-[10px] font-medium text-gray-500 mb-3">
                                                        {fmt(product.price)} / Unit
                                                    </p>
                                                    {/* Quantity controls */}
                                                    <div className="flex flex-wrap items-center gap-4">
                                                        {isServiceProduct(product) ? (
                                                            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 text-[10px] font-semibold border border-amber-500/20">
                                                                Fixed Service
                                                            </span>
                                                        ) : (
                                                            <div className="flex items-center bg-black/5 rounded-xl p-1 shrink-0 border border-black/5">
                                                                <button
                                                                    onClick={() => updateCartQty(product.id, quantity - 1)}
                                                                    className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-20"
                                                                    disabled={quantity <= 1}
                                                                >
                                                                    <Minus className="w-3 h-3" />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    max={product.stock}
                                                                    value={quantity}
                                                                    onChange={(e) => {
                                                                        const val = Number.parseInt(e.target.value, 10);
                                                                        if (!Number.isNaN(val)) updateCartQty(product.id, val);
                                                                    }}
                                                                    className="w-10 text-center text-xs font-semibold text-gray-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                />
                                                                <button
                                                                    onClick={() => updateCartQty(product.id, quantity + 1)}
                                                                    className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-20"
                                                                    disabled={quantity >= product.stock}
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                        <span className="text-xs font-semibold ml-auto" style={{ color: themeColor }}>
                                                            {fmt(product.price * (isServiceProduct(product) ? 1 : quantity))}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ---- Shipping / Delivery Info ---- */}
                                    <div ref={deliveryInfoRef} className="border border-gray-100 rounded-xl p-4 bg-gray-50/40">
                                        <h4 className="text-sm font-bold text-gray-700 mb-3">Delivery Information (required)</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Shipping Address *</label>
                                                <input
                                                    type="text"
                                                    value={shippingAddress}
                                                    onChange={(e) => setShippingAddress(e.target.value)}
                                                    placeholder="Enter your full shipping address"
                                                    required
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number *</label>
                                                <input
                                                    type="tel"
                                                    value={buyerPhone}
                                                    onChange={(e) => setBuyerPhone(e.target.value)}
                                                    placeholder="+212 6XX XXX XXX"
                                                    required
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Notes *</label>
                                                <textarea
                                                    value={deliveryNotes}
                                                    onChange={(e) => setDeliveryNotes(e.target.value)}
                                                    placeholder="Any special instructions for delivery..."
                                                    rows={2}
                                                    required
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ---- Payment Method ---- */}
                                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/40">
                                        <h4 className="text-sm font-bold text-gray-700 mb-3">Payment Method</h4>
                                        <div className="space-y-3">
                                            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === 'stripe' ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    value="stripe"
                                                    checked={paymentMethod === 'stripe'}
                                                    onChange={() => setPaymentMethod('stripe')}
                                                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                />
                                                <div className="flex-1">
                                                    <span className="block text-sm font-semibold text-gray-900">Pay Now (Credit Card)</span>
                                                    <span className="block text-xs text-gray-500">Secure payment via Stripe</span>
                                                </div>
                                            </label>
                                            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === 'cash_on_delivery' ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    value="cash_on_delivery"
                                                    checked={paymentMethod === 'cash_on_delivery'}
                                                    onChange={() => setPaymentMethod('cash_on_delivery')}
                                                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                />
                                                <div className="flex-1">
                                                    <span className="block text-sm font-semibold text-gray-900">Pay on Reception</span>
                                                    <span className="block text-xs text-gray-500">Cash on delivery (COD)</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ---- Footer (cart summary + checkout) ---- */}
                {cartItems.length > 0 && !orderSuccess && (
                    <div className="border-t border-gray-100 px-6 sm:px-8 py-5 bg-white">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 mb-1">
                                    Total Summary ({cartCount} {cartCount === 1 ? 'Item' : 'Items'})
                                </p>
                                <p className="text-2xl font-semibold text-gray-900 tracking-tight">
                                    {fmt(cartTotal)}
                                </p>
                            </div>
                            {view === 'cart' ? (
                                <button
                                    onClick={handleCartCheckout}
                                    disabled={checkingOut}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3 rounded-xl text-white text-xs font-semibold shadow-xl transition-all duration-300 transform-gpu active:scale-95 disabled:opacity-60 hover:brightness-110"
                                    style={{
                                        backgroundColor: themeColor,
                                        boxShadow: `0 12px 32px -8px ${themeColor}aa`
                                    }}
                                >
                                    {checkingOut ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Processing
                                        </>
                                    ) : (
                                        <>
                                            <ShoppingBag className="w-4 h-4" />
                                            Complete Order
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setView('cart')}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3 rounded-xl text-white text-xs font-semibold shadow-xl transition-all duration-300 transform-gpu active:scale-95 hover:brightness-110"
                                    style={{
                                        backgroundColor: themeColor,
                                        boxShadow: `0 12px 32px -8px ${themeColor}aa`
                                    }}
                                >
                                    <ShoppingCart className="w-4 h-4" />
                                    Review Cart
                                </button>
                            )}
                        </div>
                    </div>
                )}
>>>>>>> eb6221363e02667d615fd22792910b75ec97f750
            </div>
        </div>
    );
}
