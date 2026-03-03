'use client';

import React, { useEffect, useState } from 'react';
import { X, ShoppingBag, Package, Minus, Plus, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Product, CheckoutResponse } from '@/types/marketplace';

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
/*  ProductsPanel                                                      */
/* ------------------------------------------------------------------ */
export function ProductsPanel({ standId, standName, themeColor = '#4f46e5', onClose }: ProductsPanelProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);
    const [quantities, setQuantities] = useState<Record<string, number>>({});

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
        }
    };

    /* ---- Currency formatting ---- */
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
            </div>
        </div>
    );
}
