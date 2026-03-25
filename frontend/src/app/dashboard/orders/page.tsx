'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/common/Container';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { getEventLifecycle } from '@/lib/eventLifecycle';
import { downloadMarketplaceUnifiedOrderReceiptPdf } from '@/lib/pdf/receipts';
import { useAuth } from '@/context/AuthContext';
import type { Event } from '@/types/event';
import type { MarketplaceOrder, UnifiedMarketplaceOrder } from '@/types/marketplace';
import type { Stand } from '@/lib/api/types';
import { Loader2, Package, Briefcase, Download, ArrowRight, Clock3 } from 'lucide-react';

type JoinedEventsPayload = Event[] | { items?: Event[]; events?: Event[] };
type EventsListPayload = Event[] | { items?: Event[]; events?: Event[]; results?: Event[] };
type StandsListPayload = Stand[] | { items?: Stand[] };
type MarketplaceOrderExt = MarketplaceOrder & {
  stripe_session_id?: string;
  checkout_group_id?: string;
  product_type?: string;
};

function normalizeJoinedEvents(payload: JoinedEventsPayload): Event[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.events)) return payload.events;
  return [];
}

function normalizeEventsList(payload: EventsListPayload): Event[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.events)) return payload.events;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function normalizeStandsList(payload: StandsListPayload): Stand[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function resolveStandKey(stand: Stand): string {
  const maybe = stand as unknown as { id?: string; _id?: string };
  return String(maybe.id || maybe._id || '');
}

function resolveStandName(stand: Stand): string {
  const maybe = stand as unknown as { name?: string };
  return String(maybe.name || 'Enterprise Stand');
}

function resolveOrderGroupId(order: MarketplaceOrderExt): string {
  const stripeSession = String(order.stripe_session_id || '').trim();
  if (stripeSession) return `session:${stripeSession}`;

  const checkoutGroup = String(order.checkout_group_id || '').trim();
  if (checkoutGroup) return `group:${checkoutGroup}`;

  return `order:${order.id}`;
}

function buildOrderRef(groupId: string, createdAt: string): string {
  const stamp = new Date(createdAt);
  const y = Number.isNaN(stamp.getTime()) ? '0000' : String(stamp.getFullYear());
  const m = Number.isNaN(stamp.getTime()) ? '00' : String(stamp.getMonth() + 1).padStart(2, '0');
  const d = Number.isNaN(stamp.getTime()) ? '00' : String(stamp.getDate()).padStart(2, '0');
  const token = groupId.replaceAll(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'UNKNOWN';
  return `ORD-${y}${m}${d}-${token}`;
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('not found') || msg.includes('404');
}

function normalizeUnifiedOrderStatus(order: UnifiedMarketplaceOrder): UnifiedMarketplaceOrder {
  const hasPaidEvidence = Boolean(order.paid_at) || (order.items || []).some((item) => String(item.status || '').toLowerCase() === 'paid');
  if (hasPaidEvidence && order.status !== 'paid') {
    return { ...order, status: 'paid' };
  }
  return order;
}

function normalizeUnifiedOrders(orders: UnifiedMarketplaceOrder[]): UnifiedMarketplaceOrder[] {
  return (orders || []).map(normalizeUnifiedOrderStatus);
}

function resolveEventId(event: Event): string {
  return String((event as { id?: string; _id?: string }).id || (event as { id?: string; _id?: string })._id || '');
}

async function buildStandMetaMap(): Promise<Map<string, { standName: string; eventId: string }>> {
  const joined = await apiClient.get<JoinedEventsPayload>(ENDPOINTS.EVENTS.JOINED);
  const joinedEvents = normalizeJoinedEvents(joined);
  const standMeta = new Map<string, { standName: string; eventId: string }>();

  await Promise.all(
    joinedEvents.map(async (evt) => {
      const eventId = String((evt as { id?: string; _id?: string }).id || (evt as { id?: string; _id?: string })._id || '');
      if (!eventId) return;

      try {
        const standsRaw = await apiClient.get<StandsListPayload>(ENDPOINTS.STANDS.LIST(eventId));
        const stands = normalizeStandsList(standsRaw);
        for (const stand of stands) {
          const sid = resolveStandKey(stand);
          if (!sid) continue;
          standMeta.set(sid, {
            standName: resolveStandName(stand),
            eventId,
          });
        }
      } catch {
        // Ignore stand list failures for individual events.
      }
    })
  );

  return standMeta;
}

function upsertGroupedOrder(
  grouped: Map<string, UnifiedMarketplaceOrder>,
  order: MarketplaceOrderExt,
  standMeta: Map<string, { standName: string; eventId: string }>
): void {
  const stripeSession = String(order.stripe_session_id || '').trim();
  const checkoutGroup = String(order.checkout_group_id || '').trim();
  const groupId = resolveOrderGroupId(order);

  const standId = String(order.stand_id || '');
  const meta = standMeta.get(standId);

  if (!grouped.has(groupId)) {
    grouped.set(groupId, {
      group_id: groupId,
      stripe_session_id: stripeSession,
      checkout_group_id: checkoutGroup,
      stand_id: standId,
      stand_name: meta?.standName || 'Enterprise Stand',
      event_id: meta?.eventId || '',
      buyer_id: String(order.buyer_id || ''),
      payment_method: String(order.payment_method || 'stripe'),
      status: String(order.status || 'pending'),
      currency: String(order.currency || 'MAD').toUpperCase(),
      total_amount: 0,
      order_count: 0,
      shipping_address: order.shipping_address || '',
      delivery_notes: order.delivery_notes || '',
      buyer_phone: order.buyer_phone || '',
      created_at: order.created_at,
      paid_at: order.paid_at,
      items: [],
      order_ids: [],
    });
  }

  const group = grouped.get(groupId)!;
  const orderAmount = Number(order.total_amount || 0);
  group.total_amount += orderAmount;
  group.order_count += 1;
  group.order_ids.push(order.id);
  group.items.push({
    order_id: order.id,
    product_id: order.product_id,
    product_name: order.product_name,
    product_type: String(order.product_type || 'product'),
    quantity: Number(order.quantity || 1),
    unit_price: Number(order.unit_price || 0),
    total_amount: orderAmount,
    currency: String(order.currency || 'MAD').toUpperCase(),
    status: String(order.status || 'pending'),
    fulfillment_status: String(order.fulfillment_status || 'requested'),
    created_at: order.created_at,
  });

  const nextStatus = String(order.status || 'pending');
  if (group.status !== 'paid') {
    if (nextStatus === 'paid') {
      group.status = 'paid';
    } else if (group.status !== 'pending' && nextStatus === 'pending') {
      group.status = 'pending';
    } else if (group.status === 'cancelled' && nextStatus !== 'cancelled') {
      group.status = nextStatus;
    }
  }

  if (new Date(order.created_at).getTime() < new Date(group.created_at).getTime()) {
    group.created_at = order.created_at;
  }
  if (order.paid_at && (!group.paid_at || new Date(order.paid_at).getTime() > new Date(group.paid_at).getTime())) {
    group.paid_at = order.paid_at;
  }
}

const statusColor: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
};

const fulfillmentColor: Record<string, string> = {
  requested: 'bg-slate-100 text-slate-700 border-slate-200',
  processing: 'bg-blue-100 text-blue-700 border-blue-200',
  packed: 'bg-violet-100 text-violet-700 border-violet-200',
  shipped: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
};

export default function VisitorOrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<UnifiedMarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const findStandInEvent = async (eventId: string, standId: string): Promise<boolean> => {
    if (!eventId || !standId) return false;
    try {
      const standsRaw = await apiClient.get<StandsListPayload>(ENDPOINTS.STANDS.LIST(eventId));
      const stands = normalizeStandsList(standsRaw);
      return stands.some((stand) => resolveStandKey(stand) === standId);
    } catch {
      return false;
    }
  };

  const refreshPendingStripeStatuses = async (sourceOrders: UnifiedMarketplaceOrder[]): Promise<void> => {
    const pendingSessions = Array.from(
      new Set(
        sourceOrders
          .filter((order) => order.payment_method === 'stripe' && order.status === 'pending')
          .map((order) => String(order.stripe_session_id || '').trim())
          .filter(Boolean)
      )
    );

    if (pendingSessions.length === 0) return;

    await Promise.all(
      pendingSessions.map(async (sessionId) => {
        try {
          // This endpoint performs a safe Stripe session sync server-side when needed.
          await apiClient.get(ENDPOINTS.MARKETPLACE.ORDERS_BY_SESSION(sessionId));
        } catch {
          // Best-effort refresh only.
        }
      })
    );
  };

  const resolveEventIdForStand = async (standId: string, hintedEventId?: string): Promise<string | null> => {
    if (hintedEventId) return hintedEventId;

    try {
      const joined = await apiClient.get<JoinedEventsPayload>(ENDPOINTS.EVENTS.JOINED);
      const joinedEvents = normalizeJoinedEvents(joined);
      for (const evt of joinedEvents) {
        const eventId = resolveEventId(evt);
        if (!eventId) continue;
        const found = await findStandInEvent(eventId, standId);
        if (found) return eventId;
      }
    } catch {
      // Best-effort fallback only.
    }

    try {
      const allEventsRaw = await apiClient.get<EventsListPayload>(ENDPOINTS.EVENTS.LIST);
      const allEvents = normalizeEventsList(allEventsRaw);
      for (const evt of allEvents) {
        const eventId = resolveEventId(evt);
        if (!eventId) continue;
        const found = await findStandInEvent(eventId, standId);
        if (found) return eventId;
      }
    } catch {
      // Best-effort fallback only.
    }

    return null;
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.get<UnifiedMarketplaceOrder[]>(ENDPOINTS.MARKETPLACE.UNIFIED_ORDERS);
        if (Array.isArray(data) && data.length > 0) {
          const normalized = normalizeUnifiedOrders(data);
          await refreshPendingStripeStatuses(normalized);
          const refreshed = await apiClient.get<UnifiedMarketplaceOrder[]>(ENDPOINTS.MARKETPLACE.UNIFIED_ORDERS);
          setOrders(normalizeUnifiedOrders(Array.isArray(refreshed) ? refreshed : normalized));
          return;
        }

        const fallback = await loadOrdersFromLegacyApi();
        setOrders(fallback);
      } catch (error) {
        if (!isNotFoundError(error)) {
          console.error('Failed to fetch unified orders, switching to fallback source', error);
        }
        try {
          const fallback = await loadOrdersFromLegacyApi();
          setOrders(fallback);
        } catch (fallbackError) {
          console.error('Failed to fetch visitor orders from fallback source', fallbackError);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadOrdersFromLegacyApi = async (): Promise<UnifiedMarketplaceOrder[]> => {
    const rawOrders = await apiClient.get<MarketplaceOrderExt[]>(ENDPOINTS.MARKETPLACE.MY_ORDERS);
    if (!Array.isArray(rawOrders) || rawOrders.length === 0) return [];

    const standMeta = await buildStandMetaMap();

    const grouped = new Map<string, UnifiedMarketplaceOrder>();

    for (const order of rawOrders) {
      upsertGroupedOrder(grouped, order, standMeta);
    }

    const normalizedGroups = Array.from(grouped.values()).map((group) => {
      const hasPaidEvidence = Boolean(group.paid_at) || group.items.some((item) => String(item.status || '').toLowerCase() === 'paid');
      if (hasPaidEvidence) {
        group.status = 'paid';
      }
      return group;
    });

    return normalizedGroups.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  const paidOrders = useMemo(() => orders.filter((o) => o.status === 'paid'), [orders]);
  const hasOrders = orders.length > 0;

  const formatAmount = (amount: number, currency = 'MAD') =>
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: currency.toUpperCase() }).format(amount);

  const handleDownloadReceipt = async (order: UnifiedMarketplaceOrder) => {
    await downloadMarketplaceUnifiedOrderReceiptPdf({
      groupId: order.group_id,
      standName: order.stand_name,
      paymentMethod: order.payment_method,
      status: order.status,
      buyerName: user?.full_name || user?.username || 'Visitor',
      buyerEmail: user?.email,
      buyerPhone: order.buyer_phone,
      shippingAddress: order.shipping_address,
      deliveryNotes: order.delivery_notes,
      createdAt: order.created_at,
      paidAt: order.paid_at || undefined,
      items: order.items.map((item) => ({
        product_name: item.product_name,
        product_type: item.product_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: item.total_amount,
        currency: item.currency,
      })),
    });
  };

  const handleRevisitStand = async (order: UnifiedMarketplaceOrder) => {
    if (!order.stand_id) {
      router.push('/events');
      return;
    }

    setActionLoading(order.group_id);
    try {
      const resolvedEventId = await resolveEventIdForStand(order.stand_id, order.event_id);
      if (!resolvedEventId) {
        router.push('/events');
        return;
      }

      const eventData = await apiClient.get<Event>(ENDPOINTS.EVENTS.GET(resolvedEventId));
      const lifecycle = getEventLifecycle(eventData, new Date());
      const canAccessStand = lifecycle.hasScheduleSlots && lifecycle.status === 'live';

      if (canAccessStand) {
        router.push(`/events/${resolvedEventId}/stands/${order.stand_id}`);
        return;
      }

      router.push(`/events/${resolvedEventId}?event_ended=true`);
    } catch (error) {
      console.error('Failed to resolve event lifecycle before revisit', error);
      const safeEventId = order.event_id || '';
      if (safeEventId) {
        router.push(`/events/${safeEventId}?event_ended=true`);
      } else {
        router.push('/events');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const renderOrdersContent = () => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 flex items-center justify-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading your orders...
        </div>
      );
    }

    if (!hasOrders) {
      return (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <p className="text-gray-600 font-medium">No orders yet.</p>
          <p className="text-sm text-gray-500 mt-1">Visit event stands and use the marketplace to place your first order.</p>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {orders.map((order) => (
          <div key={order.group_id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{order.stand_name || 'Enterprise Stand'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Order Ref: {buildOrderRef(order.group_id, order.created_at)} · {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${statusColor[order.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {order.status}
                </span>
                <span className="px-2.5 py-1 rounded-full border text-xs font-medium bg-indigo-50 text-indigo-700 border-indigo-200">
                  {order.payment_method === 'cash_on_delivery' ? 'COD' : 'Stripe'}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {order.items.map((item) => {
                  const isService = String(item.product_type || 'product') === 'service';
                  return (
                    <div key={item.order_id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                            {isService ? <Briefcase size={12} /> : <Package size={12} />}
                            {isService ? 'Service' : `Product · Qty ${item.quantity}`}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-indigo-700 shrink-0">
                          {formatAmount(item.total_amount, item.currency || order.currency)}
                        </p>
                      </div>
                      <div className="mt-2">
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${fulfillmentColor[item.fulfillment_status || 'requested'] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {(item.fulfillment_status || 'requested').replaceAll('_', ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-700">Total: <span className="text-gray-900">{formatAmount(order.total_amount, order.currency)}</span></p>
                  {order.shipping_address && (
                    <p className="text-xs mt-1">Shipping: {order.shipping_address}</p>
                  )}
                  {order.delivery_notes && (
                    <p className="text-xs mt-0.5">Notes: {order.delivery_notes}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleDownloadReceipt(order)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                  >
                    <Download size={14} /> Receipt
                  </button>
                  <button
                    onClick={() => handleRevisitStand(order)}
                    disabled={actionLoading === order.group_id}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
                  >
                    {actionLoading === order.group_id ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    Revisit Stand
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Container className="py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">My Orders</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track all your stand purchases in unified orders. Product and service items from the same checkout are grouped together.
        </p>
      </div>

      {renderOrdersContent()}

      {paidOrders.length > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 flex items-start gap-3 text-indigo-800">
          <Clock3 className="w-5 h-5 mt-0.5" />
          <p className="text-sm">
            You have <span className="font-semibold">{paidOrders.length}</span> paid order{paidOrders.length > 1 ? 's' : ''}. Each card groups products and services from the same checkout.
          </p>
        </div>
      )}
    </Container>
  );
}
