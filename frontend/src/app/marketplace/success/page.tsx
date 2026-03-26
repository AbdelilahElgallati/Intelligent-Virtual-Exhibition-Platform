'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Package, Loader2, FileText, Briefcase } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { UnifiedMarketplaceOrder } from '@/types/marketplace';
import { useSearchParams } from 'next/navigation';
import { downloadMarketplaceUnifiedOrderReceiptPdf } from '@/lib/pdf/receipts';

import clsx from 'clsx';

function MarketplaceSuccessContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const groupIdFromUrl = searchParams.get('group_id');
    const orderIdFromUrl = searchParams.get('order_id');
    const standIdFromUrl = searchParams.get('stand_id');
    const eventIdFromUrl = searchParams.get('event_id');
    const [orders, setOrders] = useState<UnifiedMarketplaceOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                let data: UnifiedMarketplaceOrder[] = [];
                if (sessionId) {
                    data = await apiClient.get<UnifiedMarketplaceOrder[]>(
                        ENDPOINTS.MARKETPLACE.UNIFIED_ORDERS_BY_SESSION(sessionId)
                    );
                } else if (groupIdFromUrl) {
                    data = await apiClient.get<UnifiedMarketplaceOrder[]>(
                        ENDPOINTS.MARKETPLACE.UNIFIED_ORDERS_BY_GROUP(groupIdFromUrl)
                    );
                } else if (orderIdFromUrl) {
                    const all = await apiClient.get<UnifiedMarketplaceOrder[]>(ENDPOINTS.MARKETPLACE.UNIFIED_ORDERS);
                    data = all.filter(o => o.order_ids.includes(orderIdFromUrl));
                } else {
                    const all = await apiClient.get<UnifiedMarketplaceOrder[]>(ENDPOINTS.MARKETPLACE.UNIFIED_ORDERS);
                    // Show last few orders regardless of status if we just arrived here without specific params
                    data = all
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 3);
                }
                setOrders(data);
            } catch {
                /* ignore */
            } finally {
                setLoading(false);
            }
        })();
    }, [sessionId, groupIdFromUrl, orderIdFromUrl]);

    const fmt = (amount: number, currency: string = 'MAD') =>
        new Intl.NumberFormat('fr-MA', { style: 'currency', currency: currency.toUpperCase() }).format(amount);

    const grandTotal = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const grandCurrency = (orders[0] && (orders[0].currency || 'MAD')) || 'MAD';
    const backToStandHref = (standIdFromUrl && eventIdFromUrl)
        ? `/events/${eventIdFromUrl}/stands/${standIdFromUrl}`
        : '/events';
    const showOrders = !loading && orders.length > 0;

    const downloadInvoice = async () => {
        if (orders.length === 0) return;
        const first = orders[0];
        await downloadMarketplaceUnifiedOrderReceiptPdf({
            groupId: first.group_id,
            standName: first.stand_name,
            paymentMethod: first.payment_method,
            status: first.status,
            buyerPhone: first.buyer_phone,
            shippingAddress: first.shipping_address,
            deliveryNotes: first.delivery_notes,
            createdAt: first.created_at,
            paidAt: first.paid_at || undefined,
            items: first.items.map((item) => ({
                product_name: item.product_name,
                product_type: item.product_type,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_amount: item.total_amount,
                currency: item.currency,
            })),
        });
    };

    const renderOrderSummary = () => {
        if (loading) {
            return (
                <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            );
        }

        if (!showOrders) {
            return null;
        }

        return (
            <>
                <div className="space-y-3 mb-6">
                    {orders.map((order, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 transition-all hover:border-indigo-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-indigo-600 font-bold shadow-sm">
                                    {order.items.length}
                                </div>
                                <div className="text-left">
                                    <h3 className="text-sm font-bold text-gray-900 leading-tight">
                                        {order.items[0]?.product_name}
                                        {order.items.length > 1 && ` + ${order.items.length - 1} more`}
                                    </h3>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5 whitespace-nowrap">
                                        {order.payment_method === 'cash_on_delivery' || order.payment_method === 'cod' ? 'Cash on Reception' : 'Stripe Payment'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                                <span className="text-sm font-bold text-gray-900">{fmt(order.total_amount, order.currency)}</span>
                                <span className={clsx(
                                    "text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter",
                                    order.status === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                        (order.status === 'pending' && (order.payment_method === 'cash_on_delivery' || order.payment_method === 'cod')) ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                                            "bg-amber-50 text-amber-600 border-amber-100"
                                )}>
                                    {(order.status === 'pending' && (order.payment_method === 'cash_on_delivery' || order.payment_method === 'cod')) ? 'CONFIRMED' : order.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between px-3 py-3 mb-4 rounded-xl bg-indigo-50 border border-indigo-100">
                    <span className="text-sm font-semibold text-indigo-700">Grand Total</span>
                    <span className="text-lg font-bold text-indigo-800">{fmt(grandTotal, grandCurrency)}</span>
                </div>

                <button
                    onClick={downloadInvoice}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors mb-4"
                >
                    <FileText className="w-4 h-4" />
                    Download Receipt (PDF)
                </button>
            </>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
                    <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
                <p className="text-gray-500 text-sm mb-6">
                    Thank you for your purchase. Your order has been confirmed.
                </p>

                {renderOrderSummary()}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href={backToStandHref}
                        className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                    >
                        Go Back to Stand
                    </Link>
                    <Link
                        href="/events"
                        className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
                    >
                        Browse Events
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function MarketplaceSuccessPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <MarketplaceSuccessContent />
        </Suspense>
    );
}
