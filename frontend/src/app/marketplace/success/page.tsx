'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Package, Loader2, FileText, Briefcase } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { UnifiedMarketplaceOrder } from '@/types/marketplace';
import { useSearchParams } from 'next/navigation';
import { downloadMarketplaceUnifiedOrderReceiptPdf } from '@/lib/pdf/receipts';

function MarketplaceSuccessContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const standIdFromUrl = searchParams.get('stand_id');
    const eventIdFromUrl = searchParams.get('event_id');
    const [orders, setOrders] = useState<UnifiedMarketplaceOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                let data: UnifiedMarketplaceOrder[];
                if (sessionId) {
                    data = await apiClient.get<UnifiedMarketplaceOrder[]>(
                        ENDPOINTS.MARKETPLACE.UNIFIED_ORDERS_BY_SESSION(sessionId)
                    );
                } else {
                    const all = await apiClient.get<UnifiedMarketplaceOrder[]>(ENDPOINTS.MARKETPLACE.UNIFIED_ORDERS);
                    data = all
                        .filter((o) => o.status === 'paid' && o.payment_method === 'stripe')
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 5);
                }
                setOrders(data);
            } catch {
                /* ignore */
            } finally {
                setLoading(false);
            }
        })();
    }, [sessionId]);

    const fmt = (amount: number, currency: string = 'MAD') =>
        new Intl.NumberFormat('fr-MA', { style: 'currency', currency: currency.toUpperCase() }).format(amount);

    const grandTotal = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const grandCurrency = (orders[0] && (orders[0].currency || 'MAD')) || 'MAD';
    const backToStandHref = (standIdFromUrl && eventIdFromUrl)
        ? `/events/${eventIdFromUrl}/stands/${standIdFromUrl}`
        : '/events';
    const showOrders = !loading && orders.length > 0;

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
                <div className="space-y-3 mb-4 text-left">
                    {orders[0].items.map((item) => (
                        <div
                            key={item.order_id}
                            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                        >
                            {String(item.product_type || 'product') === 'service' ? (
                                <Briefcase className="w-5 h-5 text-indigo-500 shrink-0" />
                            ) : (
                                <Package className="w-5 h-5 text-indigo-500 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">
                                    {item.product_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {String(item.product_type || 'product') === 'service'
                                        ? `Service · ${fmt(Number(item.total_amount), item.currency || 'MAD')}`
                                        : `Qty: ${item.quantity} · ${fmt(Number(item.total_amount), item.currency || 'MAD')}`}
                                </p>
                            </div>
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold uppercase">
                                {orders[0].status}
                            </span>
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
