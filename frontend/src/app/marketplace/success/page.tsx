'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Package, Loader2, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { MarketplaceOrder } from '@/types/marketplace';
import { useSearchParams } from 'next/navigation';

export default function MarketplaceSuccessPage() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const standIdFromUrl = searchParams.get('stand_id');
    const eventIdFromUrl = searchParams.get('event_id');
    const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
    const [receipts, setReceipts] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                let data: MarketplaceOrder[];
                if (sessionId) {
                    // Fetch only orders for this specific Stripe session
                    data = await apiClient.get<MarketplaceOrder[]>(
                        ENDPOINTS.MARKETPLACE.ORDERS_BY_SESSION(sessionId)
                    );
                } else {
                    // Fallback: fetch recent paid orders
                    const all = await apiClient.get<MarketplaceOrder[]>(ENDPOINTS.MARKETPLACE.MY_ORDERS);
                    data = all
                        .filter((o) => o.status === 'paid')
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 5);
                }
                setOrders(data);

                // Fetch enriched receipt data (amount/currency/seller/buyer/delivery/payment)
                const receiptPairs = await Promise.all(
                    data.map(async (order) => {
                        try {
                            const receipt = await apiClient.get<any>(
                                ENDPOINTS.MARKETPLACE.ORDER_RECEIPT(order.id)
                            );
                            return [order.id, receipt] as const;
                        } catch {
                            return [order.id, null] as const;
                        }
                    })
                );
                const nextReceipts: Record<string, any> = {};
                for (const [id, receipt] of receiptPairs) {
                    if (receipt) nextReceipts[id] = receipt;
                }
                setReceipts(nextReceipts);
            } catch {
                /* ignore */
            } finally {
                setLoading(false);
            }
        })();
    }, [sessionId]);

    const fmt = (amount: number, currency: string = 'MAD') =>
        new Intl.NumberFormat('fr-MA', { style: 'currency', currency: currency.toUpperCase() }).format(amount);

    const grandTotal = orders.reduce((sum, o) => {
        const r = receipts[o.id];
        return sum + Number(r?.amount ?? o.total_amount ?? 0);
    }, 0);
    const grandCurrency = (orders[0] && (receipts[orders[0].id]?.currency || (orders[0] as any).currency)) || 'MAD';
    const backToStandHref = (standIdFromUrl && eventIdFromUrl)
        ? `/events/${eventIdFromUrl}/stands/${standIdFromUrl}`
        : '/events';

    /* ── Direct PDF Invoice Generator ── */
    const downloadInvoice = async () => {
        const { default: jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        const now = new Date();
        const invoiceNo = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const rows = orders.map((order, i) => {
            const r = receipts[order.id] || {};
            const quantity = Number(r.quantity ?? order.quantity ?? 1);
            const unitPrice = Number(r.unit_price ?? ((r.amount ?? order.total_amount ?? 0) / (quantity || 1)));
            const amount = Number(r.amount ?? order.total_amount ?? 0);
            const currency = (r.currency || (order as any).currency || 'MAD').toUpperCase();
            const paymentMethod = r.payment_method === 'cash_on_delivery' ? 'Pay on Reception (COD)' : 'Stripe';
            return [
                String(i + 1),
                order.product_name || r.product_name || 'Item',
                String(quantity),
                `${unitPrice.toFixed(2)} ${currency}`,
                `${amount.toFixed(2)} ${currency}`,
                paymentMethod,
            ];
        });

        const firstReceipt = orders[0] ? (receipts[orders[0].id] || {}) : {};
        const buyerName = firstReceipt.buyer_name || 'Visitor';
        const buyerEmail = firstReceipt.buyer_email || '';
        const buyerPhone = firstReceipt.buyer_phone || '';
        const sellerName = firstReceipt.seller_name || 'Enterprise Stand';
        const sellerEmail = firstReceipt.seller_email || '';
        const shippingAddress = firstReceipt.shipping_address || 'Not provided';
        const deliveryNotes = firstReceipt.delivery_notes || '—';

        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229);
        doc.text('MARKETPLACE INVOICE', 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Invoice #: ${invoiceNo}`, 14, 32);
        doc.text(`Date: ${dateStr}`, 14, 38);
        doc.text(`Time: ${timeStr}`, 14, 44);
        doc.text('Status: PAID', 14, 50);

        doc.setFontSize(12);
        doc.setTextColor(30);
        doc.text('Intelligent Virtual Exhibition Platform', 122, 22);
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text('Virtual Marketplace', 122, 28);

        doc.setDrawColor(200);
        doc.line(14, 56, 196, 56);

        doc.setFontSize(10);
        doc.setTextColor(60);
        doc.text(`Buyer: ${buyerName}`, 14, 64);
        if (buyerEmail) doc.text(`Email: ${buyerEmail}`, 14, 70);
        if (buyerPhone) doc.text(`Phone: ${buyerPhone}`, 14, 76);

        doc.text(`Seller: ${sellerName}`, 122, 64);
        if (sellerEmail) doc.text(`Seller Email: ${sellerEmail}`, 122, 70);
        doc.text(`Shipping: ${shippingAddress}`, 14, 84);
        doc.text(`Delivery Notes: ${deliveryNotes}`, 14, 90);

        autoTable(doc, {
            startY: 98,
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
        doc.text(`Grand Total: ${grandTotal.toFixed(2)} ${grandCurrency}`, 196, finalY + 14, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120);
        doc.text(`Stripe Session: ${sessionId || 'N/A'}`, 14, finalY + 14);
        doc.text('This is an automatically generated invoice.', 14, 285);

        doc.save(`marketplace-invoice-${invoiceNo}.pdf`);
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

                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : orders.length > 0 ? (
                    <>
                        <div className="space-y-3 mb-4 text-left">
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
                                            Qty: {order.quantity} · {fmt(Number(receipts[order.id]?.amount ?? order.total_amount), receipts[order.id]?.currency || (order as any).currency || 'MAD')}
                                        </p>
                                    </div>
                                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold uppercase">
                                        {order.status}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Grand total */}
                        <div className="flex items-center justify-between px-3 py-3 mb-4 rounded-xl bg-indigo-50 border border-indigo-100">
                            <span className="text-sm font-semibold text-indigo-700">Grand Total</span>
                            <span className="text-lg font-bold text-indigo-800">{fmt(grandTotal, grandCurrency)}</span>
                        </div>

                        {/* Download PDF Invoice */}
                        <button
                            onClick={downloadInvoice}
                            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors mb-4"
                        >
                            <FileText className="w-4 h-4" />
                            Download Invoice (PDF)
                        </button>
                    </>
                ) : null}

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
