"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { http } from "@/lib/http";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { formatInUserTZ, parseISOUTC } from "@/lib/timezone";
import type { MarketplaceOrder } from "@/types/marketplace";
import {
    Package,
    Briefcase,
    Mail,
    Phone,
    MapPin,
    CreditCard,
    Truck,
    CheckCircle2,
    Clock,
    Loader2,
    MessageSquare,
    Receipt,
    CalendarDays,
    SlidersHorizontal,
    User,
    Hash,
    Layers,
    Filter
} from "lucide-react";

type RequestStatus = "PENDING" | "CONTACTED" | "CLOSED";

type FulfillmentStatus =
    | "requested"
    | "processing"
    | "packed"
    | "shipped"
    | "delivered"
    | "completed"
    | "cancelled";

type DateFilter = "all" | "today" | "last7" | "last30";

interface ProductRequestItem {
    _id?: string;
    id?: string;
    visitor_id: string;
    enterprise_id: string;
    product_id: string;
    event_id?: string;
    message: string;
    quantity?: number | null;
    status: RequestStatus;
    created_at: string;
    visitor_name?: string;
    visitor_email?: string;
    visitor_phone?: string;
    visitor_company?: string;
    visitor_city?: string;
    visitor_country?: string;
    visitor_location?: string;
    product_name?: string;
    product_is_service?: boolean;
    product_type?: "product" | "service";
}

const ORDER_STATUS_STYLE: Record<string, string> = {
    requested: "bg-amber-50 text-amber-700 border-amber-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    packed: "bg-violet-50 text-violet-700 border-violet-200",
    shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const REQUEST_STATUS_STYLE: Record<RequestStatus, string> = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    CONTACTED: "bg-blue-50 text-blue-700 border-blue-200",
    CLOSED: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const ORDER_WORKFLOW: FulfillmentStatus[] = [
    "requested",
    "processing",
    "packed",
    "shipped",
    "delivered",
    "completed",
];

const DATE_FILTERS: Array<{ value: DateFilter; label: string }> = [
    { value: "all", label: "All dates" },
    { value: "today", label: "Today" },
    { value: "last7", label: "Last 7 days" },
    { value: "last30", label: "Last 30 days" },
];

function titleCase(input: string): string {
    return input
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function nextOrderStatus(status?: FulfillmentStatus): FulfillmentStatus | null {
    if (!status || !ORDER_WORKFLOW.includes(status)) return "processing";
    const idx = ORDER_WORKFLOW.indexOf(status);
    if (idx < 0 || idx === ORDER_WORKFLOW.length - 1) return null;
    return ORDER_WORKFLOW[idx + 1];
}

function dateMatchesFilter(rawDate: string, filter: DateFilter): boolean {
    if (filter === "all") return true;
    const value = parseISOUTC(rawDate);
    if (Number.isNaN(value.getTime())) return false;
    const now = new Date();
    if (filter === "today") {
        return value.getUTCDate() === now.getUTCDate() && 
               value.getUTCMonth() === now.getUTCMonth() && 
               value.getUTCFullYear() === now.getUTCFullYear();
    }
    const days = filter === "last7" ? 7 : 30;
    const threshold = new Date(now);
    threshold.setDate(now.getDate() - days);
    return value >= threshold;
}

function fulfillmentProgress(status: FulfillmentStatus): number {
    if (status === "cancelled") return 0;
    const idx = ORDER_WORKFLOW.indexOf(status);
    if (idx <= 0) return 0;
    return Math.round((idx / (ORDER_WORKFLOW.length - 1)) * 100);
}

export default function EnterpriseGlobalRequestsPage() {
    const [tab, setTab] = useState<"products" | "services">("products");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [events, setEvents] = useState<any[]>([]);
    const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
    const [requests, setRequests] = useState<ProductRequestItem[]>([]);

    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
    const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
    
    // Filters
    const [selectedEventId, setSelectedEventId] = useState<string>("all");
    const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | FulfillmentStatus>("all");
    const [requestStatusFilter, setRequestStatusFilter] = useState<"all" | RequestStatus>("all");
    const [dateFilter, setDateFilter] = useState<DateFilter>("all");
    const [orderNotesDraft, setOrderNotesDraft] = useState<Record<string, string>>({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [eventData, orderData, requestData] = await Promise.all([
                http.get<any[]>('/enterprise/events').catch(() => []),
                http.get<MarketplaceOrder[]>(ENDPOINTS.MARKETPLACE.ENTERPRISE_ORDERS),
                http.get<ProductRequestItem[]>("/enterprise/product-requests"),
            ]);

            setEvents(eventData || []);
            setOrders(orderData || []);
            setRequests(requestData || []);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to load requests data";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOrderStatusUpdate = async (orderId: string, status: FulfillmentStatus) => {
        try {
            setUpdatingOrderId(orderId);
            const note = (orderNotesDraft[orderId] || "").trim();
            await http.patch(ENDPOINTS.MARKETPLACE.UPDATE_ORDER_FULFILLMENT(orderId), {
                fulfillment_status: status,
                note: note || undefined,
            });
            setOrderNotesDraft((prev) => {
                const next = { ...prev };
                delete next[orderId];
                return next;
            });
            await fetchData();
        } catch (err) {
            console.error("Failed to update order status", err);
        } finally {
            setUpdatingOrderId(null);
        }
    };

    const handleRequestStatusUpdate = async (requestId: string, status: RequestStatus) => {
        try {
            setUpdatingRequestId(requestId);
            await http.patch(`/enterprise/product-requests/${requestId}/status`, { status });
            await fetchData();
        } catch (err) {
            console.error("Failed to update request status", err);
        } finally {
            setUpdatingRequestId(null);
        }
    };

    const handleCancelOrder = async (order: MarketplaceOrder) => {
        const orderId = order.id;
        if (!orderId) return;
        const confirmed = window.confirm(
            `Cancel order for "${order.product_name}"? This will mark the order as cancelled and restore stock for product items.`
        );
        if (!confirmed) return;
        const note = window.prompt("Optional cancellation note", "Cancelled by enterprise: false order") || undefined;
        try {
            setCancellingOrderId(orderId);
            await http.patch(ENDPOINTS.MARKETPLACE.CANCEL_ORDER(orderId), { note });
            await fetchData();
        } catch (err) {
            console.error("Failed to cancel order", err);
        } finally {
            setCancellingOrderId(null);
        }
    };

    const productOrders = useMemo(() => orders.filter(o => (o.product_type || "product") !== "service"), [orders]);
    const serviceOrders = useMemo(() => orders.filter(o => (o.product_type || "product") === "service"), [orders]);
    const productRequests = useMemo(() => requests.filter(r => (r.product_type || (r.product_is_service ? "service" : "product")) !== "service"), [requests]);
    const serviceRequests = useMemo(() => requests.filter(r => (r.product_type || (r.product_is_service ? "service" : "product")) === "service"), [requests]);

    const currentOrders = tab === "products" ? productOrders : serviceOrders;
    const currentRequests = tab === "products" ? productRequests : serviceRequests;

    const filteredOrders = useMemo(() => currentOrders.filter(order => {
        const status = (order.fulfillment_status || "requested") as FulfillmentStatus;
        const statusMatches = orderStatusFilter === "all" || status === orderStatusFilter;
        const eventMatches = selectedEventId === "all" || order.event_id === selectedEventId;
        const dateMatches = dateMatchesFilter(order.created_at, dateFilter);
        return statusMatches && eventMatches && dateMatches;
    }), [currentOrders, orderStatusFilter, selectedEventId, dateFilter]);

    const filteredRequests = useMemo(() => currentRequests.filter(req => {
        const statusMatches = requestStatusFilter === "all" || req.status === requestStatusFilter;
        const eventMatches = selectedEventId === "all" || req.event_id === selectedEventId;
        const dateMatches = dateMatchesFilter(req.created_at, dateFilter);
        return statusMatches && eventMatches && dateMatches;
    }), [currentRequests, requestStatusFilter, selectedEventId, dateFilter]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight">All Inquiries & Orders</h1>
                    <p className="text-zinc-500 mt-1 max-w-2xl">
                        A unified view of all visitor requests and marketplace checkouts across every event you participate in.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={loading} className="shadow-sm">
                    {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Clock size={16} className="mr-2" />}
                    Refresh Data
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-zinc-200 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Layers size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Events Active</p>
                            <p className="text-xl font-black text-zinc-900">{events.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-zinc-200 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                            <Receipt size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Total Orders</p>
                            <p className="text-xl font-black text-zinc-900">{orders.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-zinc-200 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Direct Requests</p>
                            <p className="text-xl font-black text-zinc-900">{requests.length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Filters */}
                <aside className="w-full lg:w-72 space-y-6">
                    <div className="inline-flex w-full rounded-2xl bg-zinc-100 p-1.5 gap-1 shadow-inner">
                        <button
                            onClick={() => setTab("products")}
                            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
                                tab === "products" ? "bg-white text-indigo-700 shadow-md" : "text-zinc-500 hover:text-zinc-800"
                            }`}
                        >
                            <Package size={16} /> Products
                        </button>
                        <button
                            onClick={() => setTab("services")}
                            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
                                tab === "services" ? "bg-white text-indigo-700 shadow-md" : "text-zinc-500 hover:text-zinc-800"
                            }`}
                        >
                            <Briefcase size={16} /> Services
                        </button>
                    </div>

                    <Card className="border-zinc-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-zinc-50 border-b border-zinc-100 py-3 px-4">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                <Filter size={12} /> Refine View
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Filter by Event</label>
                                <select
                                    value={selectedEventId}
                                    onChange={(e) => setSelectedEventId(e.target.value)}
                                    className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                >
                                    <option value="all">All Events</option>
                                    {events.map(ev => (
                                        <option key={ev.id || ev._id} value={ev.id || ev._id}>{ev.title}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Order Fulfillment</label>
                                <select
                                    value={orderStatusFilter}
                                    onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                                    className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                >
                                    <option value="all">All Statuses</option>
                                    {ORDER_WORKFLOW.map(s => (
                                        <option key={s} value={s}>{titleCase(s)}</option>
                                    ))}
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Request Status</label>
                                <select
                                    value={requestStatusFilter}
                                    onChange={(e) => setRequestStatusFilter(e.target.value as any)}
                                    className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="CONTACTED">Contacted</option>
                                    <option value="CLOSED">Closed</option>
                                </select>
                            </div>

                            <div className="pt-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Time Period</label>
                                <div className="flex flex-col gap-1.5">
                                    {DATE_FILTERS.map(f => (
                                        <button
                                            key={f.value}
                                            onClick={() => setDateFilter(f.value)}
                                            className={`text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                                dateFilter === f.value
                                                    ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                                                    : "text-zinc-500 hover:bg-zinc-100"
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </aside>

                {/* Main Content */}
                <main className="flex-1 space-y-8">
                    {loading ? (
                        <div className="py-32 text-center bg-white border border-zinc-200 rounded-3xl">
                            <Loader2 size={42} className="animate-spin text-indigo-600 mx-auto mb-4" />
                            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Synchronizing records...</p>
                        </div>
                    ) : error ? (
                        <Card className="border-red-200 bg-red-50 rounded-3xl">
                            <CardContent className="p-8 text-center">
                                <p className="text-red-700 font-bold">{error}</p>
                                <Button onClick={fetchData} className="mt-4 bg-red-600 text-white hover:bg-red-700">Retry Loading</Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Checkout Orders Section */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h2 className="text-lg font-black text-zinc-900 inline-flex items-center gap-2">
                                        <Receipt size={20} className="text-indigo-600" /> Checkout Orders
                                        <span className="text-xs bg-zinc-100 text-zinc-500 py-0.5 px-2 rounded-full font-bold">{filteredOrders.length}</span>
                                    </h2>
                                </div>

                                {filteredOrders.length === 0 ? (
                                    <div className="py-16 text-center bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-3xl">
                                        <Package className="text-zinc-300 mx-auto mb-3" size={32} />
                                        <p className="text-sm text-zinc-500 font-medium">No checkout orders match your current filters.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {filteredOrders.map(order => {
                                            const status = (order.fulfillment_status || "requested") as FulfillmentStatus;
                                            const nextStatus = nextOrderStatus(status);
                                            const isService = (order.product_type || "product") === "service";
                                            const progress = fulfillmentProgress(status);
                                            const event = events.find(e => (e.id || e._id) === order.event_id);

                                            return (
                                                <Card key={order.id} className="border-zinc-200 shadow-sm hover:border-indigo-200 transition-all rounded-2xl overflow-hidden">
                                                    <CardContent className="p-0">
                                                        <div className="bg-zinc-50/50 border-b border-zinc-100 px-5 py-3 flex items-center justify-between gap-4">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${ORDER_STATUS_STYLE[status]}`}>
                                                                    {titleCase(status)}
                                                                </span>
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Order #{order.id?.slice(-8).toUpperCase()}</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-zinc-500">
                                                                {formatInUserTZ(order.created_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div className="p-5 space-y-4">
                                                            <div className="flex flex-wrap items-start justify-between gap-4">
                                                                <div>
                                                                    <h3 className="font-bold text-zinc-900 text-base">{order.product_name}</h3>
                                                                    <p className="text-xs text-indigo-600 font-bold flex items-center gap-1.5 mt-0.5">
                                                                        <Layers size={12} /> {event?.title || "Direct Participation"}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-lg font-black text-zinc-900">{(order.total_amount || 0).toFixed(2)} <span className="text-xs font-bold text-zinc-400 uppercase">{order.currency}</span></p>
                                                                    {!isService && <p className="text-[10px] font-bold text-zinc-400 uppercase">Qty: {order.quantity}</p>}
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50/50 rounded-2xl p-4 border border-zinc-100">
                                                                <div className="space-y-2">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Customer Details</p>
                                                                    <p className="text-sm font-bold text-zinc-800">{order.buyer_name || "Visitor"}</p>
                                                                    <div className="flex flex-col gap-1">
                                                                        {order.buyer_email && <a href={`mailto:${order.buyer_email}`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1.5"><Mail size={12} /> {order.buyer_email}</a>}
                                                                        {order.buyer_phone && <a href={`tel:${order.buyer_phone}`} className="text-xs text-zinc-600 flex items-center gap-1.5"><Phone size={12} /> {order.buyer_phone}</a>}
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Shipping & Payment</p>
                                                                    <p className="text-xs text-zinc-600 flex items-start gap-1.5"><MapPin size={12} className="shrink-0 mt-0.5" /> {order.shipping_address || "No address provided"}</p>
                                                                    <p className="text-xs text-zinc-600 flex items-center gap-1.5"><CreditCard size={12} /> {order.payment_method === "cash_on_delivery" ? "COD" : "Stripe Online"}</p>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fulfillment Progress</p>
                                                                    <p className="text-[10px] font-black text-indigo-600">{progress}%</p>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                                                                    <div className={`h-full transition-all duration-500 ${status === 'cancelled' ? 'bg-zinc-300' : 'bg-indigo-600'}`} style={{ width: `${progress}%` }} />
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-2 pt-2">
                                                                {nextStatus ? (
                                                                    <Button
                                                                        onClick={() => handleOrderStatusUpdate(order.id!, nextStatus)}
                                                                        disabled={updatingOrderId === order.id}
                                                                        className="bg-indigo-600 hover:bg-indigo-700 text-xs h-9 rounded-xl px-4 font-bold shadow-md shadow-indigo-100"
                                                                    >
                                                                        {updatingOrderId === order.id ? <Loader2 size={14} className="animate-spin mr-2" /> : <Truck size={14} className="mr-2" />}
                                                                        Mark as {titleCase(nextStatus)}
                                                                    </Button>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-100">
                                                                        <CheckCircle2 size={14} /> Completed
                                                                    </span>
                                                                )}
                                                                
                                                                {status === "requested" && (
                                                                    <Button
                                                                        variant="outline"
                                                                        onClick={() => handleCancelOrder(order)}
                                                                        disabled={cancellingOrderId === order.id}
                                                                        className="border-zinc-200 text-zinc-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 text-xs h-9 rounded-xl px-4 font-bold"
                                                                    >
                                                                        Cancel Order
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>

                            <hr className="border-zinc-100" />

                            {/* Direct Requests Section */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h2 className="text-lg font-black text-zinc-900 inline-flex items-center gap-2">
                                        <MessageSquare size={20} className="text-indigo-600" /> Direct Inquiries
                                        <span className="text-xs bg-zinc-100 text-zinc-500 py-0.5 px-2 rounded-full font-bold">{filteredRequests.length}</span>
                                    </h2>
                                </div>

                                {filteredRequests.length === 0 ? (
                                    <div className="py-16 text-center bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-3xl">
                                        <MessageSquare className="text-zinc-300 mx-auto mb-3" size={32} />
                                        <p className="text-sm text-zinc-500 font-medium">No direct inquiries match your current filters.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {filteredRequests.map(req => {
                                            const event = events.find(e => (e.id || e._id) === req.event_id);
                                            const reqId = req.id || req._id || "";
                                            return (
                                                <Card key={reqId} className="border-zinc-200 shadow-sm hover:border-indigo-200 transition-all rounded-2xl">
                                                    <CardContent className="p-6">
                                                        <div className="flex flex-col md:flex-row justify-between gap-6">
                                                            <div className="flex-1 space-y-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-500">
                                                                        <User size={20} />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-bold text-zinc-900 text-sm">{req.visitor_name || `Visitor #${req.visitor_id?.slice(-4)}`}</h4>
                                                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                                                            {formatInUserTZ(req.created_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                        </p>
                                                                    </div>
                                                                    <span className={`ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${REQUEST_STATUS_STYLE[req.status]}`}>
                                                                        {req.status}
                                                                    </span>
                                                                </div>

                                                                <div className="bg-indigo-50/30 rounded-2xl p-4 border border-indigo-50 italic text-sm text-zinc-700 leading-relaxed">
                                                                    &ldquo;{req.message}&rdquo;
                                                                </div>

                                                                <div className="flex flex-wrap gap-3">
                                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-white border border-zinc-200 px-2.5 py-1.5 rounded-lg">
                                                                        <Package size={12} className="text-indigo-500" />
                                                                        {req.product_name}
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-white border border-zinc-200 px-2.5 py-1.5 rounded-lg">
                                                                        <Layers size={12} className="text-indigo-500" />
                                                                        {event?.title || "Direct"}
                                                                    </div>
                                                                    {req.quantity != null && (
                                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-lg">
                                                                            <Hash size={12} /> Qty: {req.quantity}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col gap-2 min-w-[180px]">
                                                                {req.status === "PENDING" && (
                                                                    <Button
                                                                        onClick={() => handleRequestStatusUpdate(reqId, "CONTACTED")}
                                                                        disabled={updatingRequestId === reqId}
                                                                        className="bg-indigo-600 hover:bg-indigo-700 h-10 font-bold rounded-xl shadow-md shadow-indigo-100"
                                                                    >
                                                                        Mark Contacted
                                                                    </Button>
                                                                )}
                                                                {req.status === "CONTACTED" && (
                                                                    <Button
                                                                        onClick={() => handleRequestStatusUpdate(reqId, "CLOSED")}
                                                                        variant="outline"
                                                                        disabled={updatingRequestId === reqId}
                                                                        className="border-zinc-200 h-10 font-bold rounded-xl"
                                                                    >
                                                                        Close Inquiry
                                                                    </Button>
                                                                )}
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <Button variant="outline" asChild className="rounded-xl border-zinc-200 h-10" disabled={!req.visitor_email}>
                                                                        <a href={req.visitor_email ? `mailto:${req.visitor_email}` : "#"}><Mail size={16} /></a>
                                                                    </Button>
                                                                    <Button variant="outline" asChild className="rounded-xl border-zinc-200 h-10" disabled={!req.visitor_phone}>
                                                                        <a href={req.visitor_phone ? `tel:${req.visitor_phone}` : "#"}><Phone size={16} /></a>
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}
