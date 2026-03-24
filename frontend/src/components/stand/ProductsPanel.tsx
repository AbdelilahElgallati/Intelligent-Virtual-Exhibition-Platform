'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, ShoppingBag, ShoppingCart, Package, Minus, Plus, Loader2, Trash2, AlertCircle, Briefcase } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { resolveMediaUrl } from '@/lib/media';
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

const isServiceProduct = (product: Product) => (product.type || 'product') === 'service';

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
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'cash_on_delivery'>('stripe');
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [placedOrderIds, setPlacedOrderIds] = useState<string[]>([]);
    const [validationToast, setValidationToast] = useState<string | null>(null);
    const deliveryInfoRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!validationToast) return;
        const t = window.setTimeout(() => setValidationToast(null), 3200);
        return () => window.clearTimeout(t);
    }, [validationToast]);

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
                setCart({});
                setOrderSuccess(true);
            }
        } catch (err: any) {
            alert(err?.message || 'Checkout failed. Please try again.');
        } finally {
            setCheckingOut(false);
        }
    };

    /* ---- Currency formatting ---- */
    const fmt = (amount: number) =>
        new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);

    const downloadReceipt = async () => {
        if (placedOrderIds.length === 0) {
            alert('No order receipt available yet.');
            return;
        }

        const { default: jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        const receiptPairs = await Promise.all(
            placedOrderIds.map(async (orderId) => {
                try {
                    const receipt = await apiClient.get<any>(ENDPOINTS.MARKETPLACE.ORDER_RECEIPT(orderId));
                    return receipt;
                } catch {
                    return null;
                }
            })
        );

        const validReceipts = receiptPairs.filter(Boolean) as any[];
        if (validReceipts.length === 0) {
            alert('Unable to fetch receipt details. Please try again later.');
            return;
        }

        const firstReceipt = validReceipts[0] || {};
        const currency = (firstReceipt.currency || 'MAD').toUpperCase();
        const grandTotal = validReceipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const now = new Date();
        const receiptNo = `RCPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229);
        doc.text('ORDER RECEIPT', 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Receipt #: ${receiptNo}`, 14, 32);
        doc.text(`Date: ${now.toLocaleDateString()}`, 14, 38);
        doc.text(`Status: ORDER PLACED`, 14, 44);

        doc.setFontSize(12);
        doc.setTextColor(30);
        doc.text('Intelligent Virtual Exhibition Platform', 112, 22);

        doc.setDrawColor(200);
        doc.line(14, 52, 196, 52);

        doc.setFontSize(10);
        doc.setTextColor(60);
        doc.text(`Buyer: ${firstReceipt.buyer_name || 'Visitor'}`, 14, 60);
        if (firstReceipt.buyer_email) doc.text(`Email: ${firstReceipt.buyer_email}`, 14, 66);
        if (firstReceipt.buyer_phone) doc.text(`Phone: ${firstReceipt.buyer_phone}`, 14, 72);
        doc.text(`Seller: ${firstReceipt.seller_name || 'Enterprise Stand'}`, 112, 60);
        doc.text(`Shipping: ${firstReceipt.shipping_address || 'Not provided'}`, 14, 80);
        doc.text(`Delivery Notes: ${firstReceipt.delivery_notes || '—'}`, 14, 86);

        const rows = validReceipts.map((r: any, i: number) => {
            const isService = String(r.product_type || 'product') === 'service';
            const qty = Number(r.quantity || 1);
            const amount = Number(r.amount || 0);
            const unitPrice = qty > 0 ? amount / qty : amount;
            return [
                String(i + 1),
                r.product_name || 'Item',
                isService ? '—' : String(qty),
                `${unitPrice.toFixed(2)} ${currency}`,
                `${amount.toFixed(2)} ${currency}`,
                r.payment_method === 'cash_on_delivery' ? 'Pay on Reception (COD)' : 'Stripe',
            ];
        });

        autoTable(doc, {
            startY: 94,
            head: [['#', 'Item', 'Qty', 'Unit Price', 'Subtotal', 'Payment']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 10 },
            styles: { fontSize: 9, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                2: { cellWidth: 14, halign: 'center' },
                3: { cellWidth: 34, halign: 'right' },
                4: { cellWidth: 34, halign: 'right' },
            },
        });

        const finalY = (doc as any).lastAutoTable?.finalY || 140;
        doc.setFontSize(12);
        doc.setTextColor(30);
        doc.setFont('helvetica', 'bold');
        doc.text(`Grand Total: ${grandTotal.toFixed(2)} ${currency}`, 196, finalY + 14, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120);
        doc.text(`Order IDs: ${placedOrderIds.join(', ')}`, 14, finalY + 14);
        doc.text('This is an automatically generated receipt.', 14, 285);

        doc.save(`order-receipt-${receiptNo}.pdf`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with heavy blur */}
            <div className="absolute inset-0 bg-white/40 backdrop-blur-md" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-[95%] sm:max-w-4xl max-h-[85vh] bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_128px_rgba(0,0,0,0.2)] border border-white/60 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300 transform-gpu">
                {validationToast && (
                    <div className="absolute top-3 left/2 -translate-x-1/2 z-20 w-[92%] max-w-md rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-xs font-black text-red-700 shadow-xl uppercase tracking-widest">
                        {validationToast}
                    </div>
                )}

                {/* ---- Header ---- */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-black/5 bg-white/40">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl shadow-inner border border-white/40" style={{ backgroundColor: `${themeColor}15` }}>
                            <ShoppingBag className="w-5 h-5" style={{ color: themeColor }} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-[0.2em] leading-none mb-1">
                                {view === 'products' ? (activeTab === 'product' ? 'Store' : 'Specialized Services') : 'Checkout Cart'}
                            </h2>
                            <p className="text-[10px] font-bold text-gray-400 truncate max-w-[280px] uppercase tracking-tighter">{standName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Cart toggle button */}
                        <button
                            onClick={() => setView(view === 'products' ? 'cart' : 'products')}
                            className="relative inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-white/40 shadow-sm hover:bg-white/80 active:scale-95"
                            style={view === 'cart' ? { backgroundColor: themeColor, borderColor: themeColor, color: 'white' } : { backgroundColor: 'white/60' }}
                        >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{view === 'products' ? 'My Cart' : 'Browse Store'}</span>
                            {cartCount > 0 && (
                                <span
                                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-black text-white px-1 shadow-lg"
                                    style={{ backgroundColor: view === 'cart' ? 'black' : themeColor }}
                                >
                                    {cartCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-full hover:bg-black/5 text-gray-400 hover:text-gray-900 transition-all active:scale-90"
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
                            <div className="flex gap-2 mb-8 bg-black/5 p-1.5 rounded-2xl w-fit">
                                <button
                                    onClick={() => setActiveTab('product')}
                                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'product'
                                            ? 'bg-white text-gray-900 shadow-md'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <Package className="w-3.5 h-3.5" />
                                    Products
                                </button>
                                <button
                                    onClick={() => setActiveTab('service')}
                                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'service'
                                            ? 'bg-white text-gray-900 shadow-md'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <Briefcase className="w-3.5 h-3.5" />
                                    Services
                                </button>
                            </div>

                            {filteredProducts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-black/5 rounded-[2.5rem] border border-dashed border-black/10">
                                    {activeTab === 'service' ? <Briefcase className="w-12 h-12 mb-4 text-gray-200" /> : <Package className="w-12 h-12 mb-4 text-gray-200" />}
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">No {activeTab}s available</p>
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
                                                className="group relative flex flex-col bg-white/40 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)] hover:bg-white/80 hover:shadow-[0_12px_48px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-1 overflow-hidden"
                                            >
                                                {/* Product image */}
                                                <div className="relative w-full h-44 bg-black/5 overflow-hidden">
                                                    <img
                                                        src={resolveMediaUrl(product.image_url) || '/stands/office-bg.jpg'}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                        draggable={false}
                                                        onError={(e) => {
                                                            e.currentTarget.src = '/stands/office-bg.jpg';
                                                        }}
                                                    />
                                                    {inCart > 0 && (
                                                        <div
                                                            className="absolute top-3 right-3 px-3 py-1 rounded-full text-[9px] font-black text-white shadow-xl animate-in zoom-in"
                                                            style={{ backgroundColor: themeColor }}
                                                        >
                                                            {inCart} IN CART
                                                        </div>
                                                    )}
                                                    {isService && (
                                                        <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-amber-500 text-white text-[9px] font-black shadow-lg uppercase tracking-widest">
                                                            Service
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-6 flex-1 flex flex-col">
                                                    <div className="flex items-start justify-between gap-3 mb-2">
                                                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-tight leading-snug line-clamp-2">
                                                            {product.name}
                                                        </h3>
                                                        <div
                                                            className="shrink-0 text-sm font-black"
                                                            style={{ color: themeColor }}
                                                        >
                                                            {fmt(product.price)}
                                                        </div>
                                                    </div>

                                                    {product.description && (
                                                        <p className="text-[11px] text-gray-500 font-medium leading-relaxed line-clamp-2 mb-4">
                                                            {product.description}
                                                        </p>
                                                    )}

                                                    <div className="mt-auto pt-4 flex flex-col gap-4 border-t border-black/5">
                                                        {!isService && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Availability</span>
                                                                {outOfStock ? (
                                                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Sold Out</span>
                                                                ) : (
                                                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{product.stock} Units</span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {!outOfStock && (
                                                            <button
                                                                onClick={() => addToCart(product)}
                                                                disabled={!isService && inCart >= product.stock}
                                                                className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl text-white text-[10px] font-black uppercase tracking-[0.1em] shadow-xl transition-all duration-300 transform-gpu active:scale-95 disabled:opacity-30 hover:brightness-110"
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
                                                className="flex gap-6 p-6 rounded-[2rem] bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] transition-all duration-300"
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
                                                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight line-clamp-1">
                                                            {product.name}
                                                        </h4>
                                                        <button
                                                            onClick={() => removeFromCart(product.id)}
                                                            className="p-2 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all active:scale-90 shrink-0"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                                                        {fmt(product.price)} / Unit
                                                    </p>
                                                    {/* Quantity controls */}
                                                    <div className="flex flex-wrap items-center gap-4">
                                                        {isServiceProduct(product) ? (
                                                            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 text-[9px] font-black border border-amber-500/20 uppercase tracking-widest">
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
                                                                    className="w-10 text-center text-xs font-black text-gray-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                                        <span className="text-xs font-black ml-auto" style={{ color: themeColor }}>
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
                    <div className="border-t border-black/5 px-8 py-6 bg-white/40">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                    Total Summary ({cartCount} {cartCount === 1 ? 'Item' : 'Items'})
                                </p>
                                <p className="text-2xl font-black text-gray-900 tracking-tight">
                                    {fmt(cartTotal)}
                                </p>
                            </div>
                            {view === 'cart' ? (
                                <button
                                    onClick={handleCartCheckout}
                                    disabled={checkingOut}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all duration-300 transform-gpu active:scale-95 disabled:opacity-60 hover:brightness-110"
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
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all duration-300 transform-gpu active:scale-95 hover:brightness-110"
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
            </div>
        </div>
    );
}
