'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, ShoppingBag, ShoppingCart, Package, Minus, Plus, Loader2, Trash2, AlertCircle, Briefcase } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Product, CartCheckoutResponse } from '@/types/marketplace';

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
/*  Cart item type                                                     */
/* ------------------------------------------------------------------ */
interface CartEntry {
    product: Product;
    quantity: number;
}

/* ------------------------------------------------------------------ */
/*  ProductsPanel (centered modal with cart)                           */
/* ------------------------------------------------------------------ */
export function ProductsPanel({ standId, standName, themeColor = '#4f46e5', onClose }: ProductsPanelProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cart, setCart] = useState<Record<string, CartEntry>>({});
    const [checkingOut, setCheckingOut] = useState(false);
    const [view, setView] = useState<'products' | 'cart'>('products');
    const [activeTab, setActiveTab] = useState<'product' | 'service'>('product');
    const [shippingAddress, setShippingAddress] = useState('');
    const [deliveryNotes, setDeliveryNotes] = useState('');
    const [buyerPhone, setBuyerPhone] = useState('');

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

    /* ---- Filter by tab ---- */
    const filteredProducts = products.filter((p) => (p.type || 'product') === activeTab);

    /* ---- Cart helpers ---- */
    const cartItems = Object.values(cart);
    const cartCount = cartItems.reduce((sum, c) => sum + c.quantity, 0);
    const cartTotal = cartItems.reduce((sum, c) => sum + c.product.price * c.quantity, 0);

    const addToCart = useCallback((product: Product) => {
        setCart((prev) => {
            const existing = prev[product.id];
            const currentQty = existing ? existing.quantity : 0;
            if (currentQty >= product.stock) return prev;
            return { ...prev, [product.id]: { product, quantity: currentQty + 1 } };
        });
    }, []);

    const updateCartQty = useCallback((productId: string, qty: number) => {
        setCart((prev) => {
            const entry = prev[productId];
            if (!entry) return prev;
            const clamped = Math.max(0, Math.min(qty, entry.product.stock, 100));
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
        setCheckingOut(true);
        try {
            const items = cartItems.map((c) => ({
                product_id: c.product.id,
                quantity: c.quantity,
            }));
            const resp = await apiClient.post<CartCheckoutResponse>(
                ENDPOINTS.MARKETPLACE.CART_CHECKOUT(standId),
                {
                    items,
                    shipping_address: shippingAddress || undefined,
                    delivery_notes: deliveryNotes || undefined,
                    buyer_phone: buyerPhone || undefined,
                },
            );
            window.location.href = resp.payment_url;
        } catch (err: any) {
            alert(err?.message || 'Checkout failed. Please try again.');
        } finally {
            setCheckingOut(false);
        }
    };

    /* ---- Currency formatting ---- */
    const fmt = (amount: number, currency: string = 'MAD') =>
        new Intl.NumberFormat('fr-MA', { style: 'currency', currency: currency.toUpperCase() }).format(amount);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-gray-200/60 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200">

                {/* ---- Header ---- */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ backgroundColor: `${themeColor}08` }}>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${themeColor}15` }}>
                            <ShoppingBag className="w-5 h-5" style={{ color: themeColor }} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {view === 'products' ? (activeTab === 'product' ? 'Products' : 'Services') : 'Shopping Cart'}
                            </h2>
                            <p className="text-xs text-gray-500 truncate max-w-[280px]">{standName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Cart toggle button */}
                        <button
                            onClick={() => setView(view === 'products' ? 'cart' : 'products')}
                            className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all border border-gray-200 hover:bg-gray-50"
                            style={view === 'cart' ? { backgroundColor: `${themeColor}12`, borderColor: themeColor, color: themeColor } : {}}
                        >
                            <ShoppingCart className="w-4 h-4" />
                            <span className="hidden sm:inline">{view === 'products' ? 'Cart' : 'Browse'}</span>
                            {cartCount > 0 && (
                                <span
                                    className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
                                    style={{ backgroundColor: themeColor }}
                                >
                                    {cartCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ---- Body ---- */}
                <div className="flex-1 overflow-y-auto p-6">
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

                    {/* ====== PRODUCTS VIEW ====== */}
                    {!loading && !error && view === 'products' && (
                        <>
                            {/* Tab toggle */}
                            <div className="flex gap-2 mb-5">
                                <button
                                    onClick={() => setActiveTab('product')}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                                        activeTab === 'product'
                                            ? 'text-white border-transparent shadow-sm'
                                            : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                    style={activeTab === 'product' ? { backgroundColor: themeColor } : {}}
                                >
                                    <Package className="w-4 h-4" />
                                    Products
                                </button>
                                <button
                                    onClick={() => setActiveTab('service')}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                                        activeTab === 'service'
                                            ? 'text-white border-transparent shadow-sm'
                                            : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                    style={activeTab === 'service' ? { backgroundColor: themeColor } : {}}
                                >
                                    <Briefcase className="w-4 h-4" />
                                    Services
                                </button>
                            </div>

                            {filteredProducts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                    <Package className="w-10 h-10 mb-3 text-gray-300" />
                                    <p className="text-sm font-medium text-gray-500">No {activeTab === 'product' ? 'products' : 'services'} yet</p>
                                    <p className="text-xs text-gray-400 mt-1">This stand hasn&apos;t listed any {activeTab === 'product' ? 'products' : 'services'}.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredProducts.map((product) => {
                                        const inCart = cart[product.id]?.quantity ?? 0;
                                        const outOfStock = product.stock <= 0;

                                        return (
                                            <div
                                                key={product.id}
                                                className="rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                                            >
                                                {/* Product image */}
                                                {product.image_url && (
                                                    <div className="relative w-full h-40 bg-gray-100">
                                                        <img
                                                            src={product.image_url}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover"
                                                            draggable={false}
                                                        />
                                                        {inCart > 0 && (
                                                            <div
                                                                className="absolute top-2 right-2 min-w-[24px] h-6 flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1.5"
                                                                style={{ backgroundColor: themeColor }}
                                                            >
                                                                {inCart} in cart
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="p-4 flex-1 flex flex-col">
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
                                                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
                                                            {product.description}
                                                        </p>
                                                    )}

                                                    {/* Stock badge */}
                                                    <div className="mb-3 mt-auto">
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

                                                    {/* Add to Cart button */}
                                                    {!outOfStock && (
                                                        <button
                                                            onClick={() => addToCart(product)}
                                                            disabled={inCart >= product.stock}
                                                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
                                                            style={{ backgroundColor: themeColor }}
                                                        >
                                                            <ShoppingCart className="w-4 h-4" />
                                                            {inCart > 0 ? 'Add More' : 'Add to Cart'}
                                                        </button>
                                                    )}
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
                            {cartItems.length === 0 ? (
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
                                    <div className="space-y-3">
                                    {cartItems.map(({ product, quantity }) => (
                                        <div
                                            key={product.id}
                                            className="flex gap-4 p-4 rounded-xl border border-gray-100 bg-white shadow-sm"
                                        >
                                            {/* Thumbnail */}
                                            {product.image_url && (
                                                <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                                                    <img
                                                        src={product.image_url}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                        draggable={false}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="text-sm font-bold text-gray-900 line-clamp-1">
                                                        {product.name}
                                                    </h4>
                                                    <button
                                                        onClick={() => removeFromCart(product.id)}
                                                        className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mb-2">
                                                    {fmt(product.price, product.currency)} each · {product.stock} in stock
                                                </p>
                                                {/* Quantity controls */}
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                                        <button
                                                            onClick={() => updateCartQty(product.id, quantity - 1)}
                                                            className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
                                                            disabled={quantity <= 1}
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={product.stock}
                                                            value={quantity}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value, 10);
                                                                if (!isNaN(val)) updateCartQty(product.id, val);
                                                            }}
                                                            className="w-14 text-center text-xs font-semibold text-gray-800 bg-gray-50/50 border-x border-gray-200 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                        <button
                                                            onClick={() => updateCartQty(product.id, quantity + 1)}
                                                            className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
                                                            disabled={quantity >= product.stock}
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <span className="text-sm font-bold" style={{ color: themeColor }}>
                                                        {fmt(product.price * quantity, product.currency)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    </div>

                                    {/* ---- Shipping / Delivery Info ---- */}
                                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/40">
                                        <h4 className="text-sm font-bold text-gray-700 mb-3">Delivery Information (optional)</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Shipping Address</label>
                                                <input
                                                    type="text"
                                                    value={shippingAddress}
                                                    onChange={(e) => setShippingAddress(e.target.value)}
                                                    placeholder="Enter your full shipping address"
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
                                                <input
                                                    type="tel"
                                                    value={buyerPhone}
                                                    onChange={(e) => setBuyerPhone(e.target.value)}
                                                    placeholder="+212 6XX XXX XXX"
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Notes</label>
                                                <textarea
                                                    value={deliveryNotes}
                                                    onChange={(e) => setDeliveryNotes(e.target.value)}
                                                    placeholder="Any special instructions for delivery..."
                                                    rows={2}
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ---- Footer (cart summary + checkout) ---- */}
                {cartItems.length > 0 && (
                    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/60">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">
                                    {cartCount} item{cartCount !== 1 ? 's' : ''} in cart
                                </p>
                                <p className="text-lg font-bold text-gray-900">
                                    Total: {fmt(cartTotal)}
                                </p>
                            </div>
                            <button
                                onClick={handleCartCheckout}
                                disabled={checkingOut}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold shadow-md hover:opacity-90 transition-all disabled:opacity-60"
                                style={{ backgroundColor: themeColor }}
                            >
                                {checkingOut ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processing…
                                    </>
                                ) : (
                                    <>
                                        <ShoppingBag className="w-4 h-4" />
                                        Checkout · {fmt(cartTotal)}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
