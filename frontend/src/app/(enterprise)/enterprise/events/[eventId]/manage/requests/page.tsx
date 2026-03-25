"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { http } from "@/lib/http";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { formatInUserTZ } from "@/lib/timezone";
import type { MarketplaceOrder } from "@/types/marketplace";
import {
    ArrowLeft,
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

interface StandRef {
    id: string;
    name: string;
    event_id: string;
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

    const value = new Date(rawDate);
    if (Number.isNaN(value.getTime())) return false;

    const now = new Date();

    if (filter === "today") {
        return value.toDateString() === now.toDateString();
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

export default function EnterpriseEventRequestsPage() {
    const params = useParams();
    const eventId = params.eventId as string;

    const [tab, setTab] = useState<"products" | "services">("products");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [stand, setStand] = useState<StandRef | null>(null);
    const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
    const [requests, setRequests] = useState<ProductRequestItem[]>([]);

    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
    const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
    const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | FulfillmentStatus>("all");
    const [requestStatusFilter, setRequestStatusFilter] = useState<"all" | RequestStatus>("all");
    const [dateFilter, setDateFilter] = useState<DateFilter>("all");
    const [orderNotesDraft, setOrderNotesDraft] = useState<Record<string, string>>({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const standData = await http.get<StandRef>(`/enterprise/events/${eventId}/stand`);
            setStand(standData);

            const [standOrders, allRequests] = await Promise.all([
                http.get<MarketplaceOrder[]>(ENDPOINTS.MARKETPLACE.STAND_ORDERS(standData.id)),
                http.get<ProductRequestItem[]>("/enterprise/product-requests"),
            ]);

            setOrders(standOrders || []);
            setRequests((allRequests || []).filter((req) => req.event_id === eventId));
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to load requests data";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        if (eventId) fetchData();
    }, [eventId, fetchData]);

    const serviceOrders = useMemo(
        () => orders.filter((order) => (order.product_type || "product") === "service"),
        [orders]
    );

    const productOrders = useMemo(
        () => orders.filter((order) => (order.product_type || "product") !== "service"),
        [orders]
    );

    const serviceRequests = useMemo(
        () => requests.filter((req) => (req.product_type || (req.product_is_service ? "service" : "product")) === "service"),
        [requests]
    );

    const productRequests = useMemo(
        () => requests.filter((req) => (req.product_type || (req.product_is_service ? "service" : "product")) !== "service"),
        [requests]
    );

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
            await http.patch(ENDPOINTS.MARKETPLACE.CANCEL_ORDER(orderId), {
                note,
            });
            await fetchData();
        } catch (err) {
            console.error("Failed to cancel order", err);
        } finally {
            setCancellingOrderId(null);
        }
    };

    const currentOrders = tab === "products" ? productOrders : serviceOrders;
    const currentRequests = tab === "products" ? productRequests : serviceRequests;

    const filteredOrders = useMemo(
        () =>
            currentOrders.filter((order) => {
                const status = (order.fulfillment_status || "requested") as FulfillmentStatus;
                const statusMatches = orderStatusFilter === "all" || status === orderStatusFilter;
                const dateMatches = dateMatchesFilter(order.created_at, dateFilter);
                return statusMatches && dateMatches;
            }),
        [currentOrders, dateFilter, orderStatusFilter]
    );

    const filteredRequests = useMemo(
        () =>
            currentRequests.filter((req) => {
                const statusMatches = requestStatusFilter === "all" || req.status === requestStatusFilter;
                const dateMatches = dateMatchesFilter(req.created_at, dateFilter);
                return statusMatches && dateMatches;
            }),
        [currentRequests, dateFilter, requestStatusFilter]
    );

    return (
        <div className="space-y-6 pb-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <Link
                        href={`/enterprise/events/${eventId}/manage`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                    >
                        <ArrowLeft size={14} />
                        Back to Event Management
                    </Link>
                    <h1 className="mt-2 text-2xl font-black text-zinc-900 tracking-tight">Products & Services Requests</h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Manage visitor requests, payment details, delivery workflow, and contact points for this event.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={loading}>
                    {loading ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Clock size={14} className="mr-2" />}
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="border-zinc-200">
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Stand</p>
                        <p className="text-sm font-bold text-zinc-900 mt-1 truncate">{stand?.name || "—"}</p>
                    </CardContent>
                </Card>
                <Card className="border-zinc-200">
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Checkout Orders</p>
                        <p className="text-sm font-bold text-zinc-900 mt-1">{orders.length}</p>
                    </CardContent>
                </Card>
                <Card className="border-zinc-200">
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Direct Requests</p>
                        <p className="text-sm font-bold text-zinc-900 mt-1">{requests.length}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="inline-flex rounded-2xl bg-zinc-100 p-1 gap-1">
                <button
                    onClick={() => setTab("products")}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                        tab === "products" ? "bg-white text-indigo-700 shadow-sm" : "text-zinc-600"
                    }`}
                >
                    <Package size={16} /> Products
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-700">
                        {productOrders.length + productRequests.length}
                    </span>
                </button>
                <button
                    onClick={() => setTab("services")}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                        tab === "services" ? "bg-white text-indigo-700 shadow-sm" : "text-zinc-600"
                    }`}
                >
                    <Briefcase size={16} /> Services
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-700">
                        {serviceOrders.length + serviceRequests.length}
                    </span>
                </button>
            </div>

            <Card className="border-zinc-200">
                <CardContent className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:max-w-2xl">
                            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                                <span className="mb-1 inline-flex items-center gap-1.5"><SlidersHorizontal size={13} /> Order status</span>
                                <select
                                    value={orderStatusFilter}
                                    onChange={(e) => setOrderStatusFilter(e.target.value as "all" | FulfillmentStatus)}
                                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700"
                                >
                                    <option value="all">All order statuses</option>
                                    {ORDER_WORKFLOW.map((status) => (
                                        <option key={status} value={status}>{titleCase(status)}</option>
                                    ))}
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </label>

                            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                                <span className="mb-1 inline-flex items-center gap-1.5"><SlidersHorizontal size={13} /> Request status</span>
                                <select
                                    value={requestStatusFilter}
                                    onChange={(e) => setRequestStatusFilter(e.target.value as "all" | RequestStatus)}
                                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700"
                                >
                                    <option value="all">All request statuses</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="CONTACTED">Contacted</option>
                                    <option value="CLOSED">Closed</option>
                                </select>
                            </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 inline-flex items-center gap-1.5">
                                <CalendarDays size={13} /> Date
                            </span>
                            {DATE_FILTERS.map((filter) => (
                                <button
                                    key={filter.value}
                                    onClick={() => setDateFilter(filter.value)}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                        dateFilter === filter.value
                                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="py-24 text-center">
                    <Loader2 size={38} className="animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-sm text-zinc-500">Loading event requests...</p>
                </div>
            ) : error ? (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    <Card className="border-zinc-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-bold text-zinc-900 inline-flex items-center gap-2">
                                <Receipt size={16} /> Checkout Orders
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {filteredOrders.length === 0 && (
                                <p className="text-sm text-zinc-500">No checkout orders in this section yet.</p>
                            )}

                            {filteredOrders.map((order) => {
                                const status = (order.fulfillment_status || "requested") as FulfillmentStatus;
                                const nextStatus = nextOrderStatus(status);
                                const orderId = order.id;
                                const isService = (order.product_type || "product") === "service";
                                const progress = fulfillmentProgress(status);
                                const lastHistory = order.fulfillment_history?.[order.fulfillment_history.length - 1];

                                return (
                                    <div key={orderId} className="rounded-xl border border-zinc-200 p-4 bg-white">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <p className="font-bold text-zinc-900 text-sm">{order.product_name}</p>
                                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 uppercase">
                                                {isService ? "Service" : "Product"}
                                            </span>
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${ORDER_STATUS_STYLE[status] || ORDER_STATUS_STYLE.requested}`}>
                                                {titleCase(status)}
                                            </span>
                                            <span className="ml-auto text-xs text-zinc-500">
                                                {formatInUserTZ(order.created_at, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-zinc-600">
                                            {!isService && <p><span className="font-semibold text-zinc-800">Quantity:</span> {order.quantity}</p>}
                                            <p><span className="font-semibold text-zinc-800">Total:</span> {(order.total_amount || 0).toFixed(2)} {(order.currency || "MAD").toUpperCase()}</p>
                                            <p className="inline-flex items-center gap-1.5"><CreditCard size={13} /><span className="font-semibold text-zinc-800">Payment:</span> {order.payment_method === "cash_on_delivery" ? "Pay on reception (COD)" : "Stripe"}</p>
                                            {order.payment_method === "stripe" && (
                                                <p className="truncate"><span className="font-semibold text-zinc-800">Stripe intent:</span> {order.stripe_payment_intent_id || order.stripe_session_id || "Pending"}</p>
                                            )}
                                            <p className="md:col-span-2"><span className="font-semibold text-zinc-800">Receiver:</span> {order.buyer_name || "Visitor"}{order.buyer_email ? ` (${order.buyer_email})` : ""}</p>
                                            {order.buyer_phone && (
                                                <p className="md:col-span-2"><span className="font-semibold text-zinc-800">Receiver phone:</span> {order.buyer_phone}</p>
                                            )}
                                            <p className="inline-flex items-center gap-1.5 md:col-span-2"><MapPin size={13} /><span className="font-semibold text-zinc-800">Shipping:</span> {order.shipping_address || "No shipping address provided"}</p>
                                            {order.delivery_notes && (
                                                <p className="md:col-span-2"><span className="font-semibold text-zinc-800">Delivery notes:</span> {order.delivery_notes}</p>
                                            )}
                                        </div>

                                        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                            <div className="flex items-center justify-between text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                                                <span>Fulfillment timeline</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="mt-2 h-2 rounded-full bg-zinc-200 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${status === "cancelled" ? "bg-zinc-400" : "bg-emerald-500"}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                                                <span>{titleCase(ORDER_WORKFLOW[0])}</span>
                                                <span className="font-semibold text-zinc-700">Current: {titleCase(status)}</span>
                                                <span>{titleCase(ORDER_WORKFLOW[ORDER_WORKFLOW.length - 1])}</span>
                                            </div>
                                        </div>

                                        {(order.fulfillment_note || lastHistory?.note) && (
                                            <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-2.5 text-xs text-indigo-800">
                                                <span className="font-semibold">Latest internal note:</span>{" "}
                                                {order.fulfillment_note || lastHistory?.note}
                                            </div>
                                        )}

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            {order.buyer_email && (
                                                <a
                                                    href={`mailto:${order.buyer_email}?subject=Order update for ${encodeURIComponent(order.product_name)}`}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                                                >
                                                    <Mail size={13} /> Email visitor
                                                </a>
                                            )}
                                            {order.buyer_phone && (
                                                <a
                                                    href={`tel:${order.buyer_phone}`}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                                                >
                                                    <Phone size={13} /> Call visitor
                                                </a>
                                            )}

                                            {nextStatus ? (
                                                <div className="ml-auto w-full md:w-auto md:min-w-[380px] space-y-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Optional internal note for this status change"
                                                        value={orderNotesDraft[orderId] || ""}
                                                        onChange={(e) =>
                                                            setOrderNotesDraft((prev) => ({
                                                                ...prev,
                                                                [orderId]: e.target.value,
                                                            }))
                                                        }
                                                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-700 placeholder:text-zinc-400"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                                                        disabled={updatingOrderId === orderId || cancellingOrderId === orderId}
                                                        onClick={() => handleOrderStatusUpdate(orderId, nextStatus)}
                                                    >
                                                        {updatingOrderId === orderId ? (
                                                            <Loader2 size={14} className="mr-1.5 animate-spin" />
                                                        ) : (
                                                            <Truck size={14} className="mr-1.5" />
                                                        )}
                                                        Mark as {titleCase(nextStatus)}
                                                    </Button>

                                                    {status !== "cancelled" && status !== "completed" && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="w-full border-red-200 text-red-700 hover:bg-red-50"
                                                            disabled={cancellingOrderId === orderId || updatingOrderId === orderId}
                                                            onClick={() => handleCancelOrder(order)}
                                                        >
                                                            {cancellingOrderId === orderId ? (
                                                                <Loader2 size={14} className="mr-1.5 animate-spin" />
                                                            ) : (
                                                                <Clock size={14} className="mr-1.5" />
                                                            )}
                                                            Cancel checkout order
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                                                    <CheckCircle2 size={13} /> Workflow complete
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card className="border-zinc-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-bold text-zinc-900 inline-flex items-center gap-2">
                                <MessageSquare size={16} /> Direct Visitor Requests
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {filteredRequests.length === 0 && (
                                <p className="text-sm text-zinc-500">No direct visitor requests in this section yet.</p>
                            )}

                            {filteredRequests.map((req) => {
                                const reqId = req.id || req._id || "";
                                return (
                                    <div key={reqId} className="rounded-xl border border-zinc-200 p-4 bg-white">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <p className="font-bold text-zinc-900 text-sm">{req.product_name || "Request"}</p>
                                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 uppercase">
                                                {(req.product_type || (req.product_is_service ? "service" : "product")) === "service" ? "Service" : "Product"}
                                            </span>
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${REQUEST_STATUS_STYLE[req.status]}`}>
                                                {req.status}
                                            </span>
                                            <span className="ml-auto text-xs text-zinc-500">
                                                {formatInUserTZ(req.created_at, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <p className="text-sm text-zinc-700 italic">&ldquo;{req.message}&rdquo;</p>
                                        <div className="mt-2 text-sm text-zinc-600 grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <p><span className="font-semibold text-zinc-800">Visitor:</span> {req.visitor_name || `Visitor #${req.visitor_id?.slice(-4) || "----"}`}</p>
                                            {((req.product_type || (req.product_is_service ? "service" : "product")) !== "service") && req.quantity != null && (
                                                <p><span className="font-semibold text-zinc-800">Quantity:</span> {req.quantity}</p>
                                            )}
                                            {req.visitor_email && <p><span className="font-semibold text-zinc-800">Email:</span> {req.visitor_email}</p>}
                                            {req.visitor_phone && <p><span className="font-semibold text-zinc-800">Phone:</span> {req.visitor_phone}</p>}
                                            {req.visitor_company && <p><span className="font-semibold text-zinc-800">Company:</span> {req.visitor_company}</p>}
                                            {(req.visitor_location || req.visitor_city || req.visitor_country) && (
                                                <p className="inline-flex items-center gap-1.5"><MapPin size={13} /><span className="font-semibold text-zinc-800">Location:</span> {req.visitor_location || [req.visitor_city, req.visitor_country].filter(Boolean).join(", ")}</p>
                                            )}
                                            <p><span className="font-semibold text-zinc-800">Payment:</span> To be confirmed with visitor</p>
                                        </div>

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            {req.visitor_email && (
                                                <a
                                                    href={`mailto:${req.visitor_email}?subject=Regarding your request for ${encodeURIComponent(req.product_name || "our offering")}`}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                                                >
                                                    <Mail size={13} /> Email visitor
                                                </a>
                                            )}
                                            {req.visitor_phone && (
                                                <a
                                                    href={`tel:${req.visitor_phone}`}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                                                >
                                                    <Phone size={13} /> Call visitor
                                                </a>
                                            )}

                                            {req.status === "PENDING" && (
                                                <Button
                                                    size="sm"
                                                    className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                                                    disabled={updatingRequestId === reqId}
                                                    onClick={() => handleRequestStatusUpdate(reqId, "CONTACTED")}
                                                >
                                                    {updatingRequestId === reqId ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Clock size={14} className="mr-1.5" />}
                                                    {(req.product_type || (req.product_is_service ? "service" : "product")) === "service" ? "Confirm Service Details" : "Mark Contacted"}
                                                </Button>
                                            )}
                                            {req.status === "CONTACTED" && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="ml-auto"
                                                    disabled={updatingRequestId === reqId}
                                                    onClick={() => handleRequestStatusUpdate(reqId, "CLOSED")}
                                                >
                                                    {updatingRequestId === reqId ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <CheckCircle2 size={14} className="mr-1.5" />}
                                                    Mark Closed
                                                </Button>
                                            )}
                                            {req.status === "CLOSED" && (
                                                <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600">
                                                    <CheckCircle2 size={13} /> Completed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
