'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Package, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { MarketplaceOrder } from '@/types/marketplace';
import { useSearchParams } from 'next/navigation';

export default function MarketplaceSuccessPage() {
    const searchParams = useSearchParams();
    const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const data = await apiClient.get<MarketplaceOrder[]>(ENDPOINTS.MARKETPLACE.MY_ORDERS);
                // Show most recent paid orders first
                const sorted = data
                    .filter((o) => o.status === 'paid')
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setOrders(sorted.slice(0, 5));
            } catch {
                /* ignore */
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const fmt = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

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

                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : orders.length > 0 ? (
                    <div className="space-y-3 mb-6 text-left">
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                            >
                                <Package className="w-5 h-5 text-indigo-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">
                                        {order.product_name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Qty: {order.quantity} · {fmt(order.total_amount)}
                                    </p>
                                </div>
                                <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold uppercase">
                                    {order.status}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : null}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                    >
                        Go to Dashboard
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
