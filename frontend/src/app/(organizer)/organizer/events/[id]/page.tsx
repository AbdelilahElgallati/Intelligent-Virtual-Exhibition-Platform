"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { eventsApi } from "@/lib/api/events";
import { OrganizerEvent, EventStatus } from "@/types/event";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ArrowLeft,
  Clock,
  CreditCard,
  Link2,
  CalendarDays,
  BarChart2,
  Copy,
  Check,
  AlertTriangle,
  XCircle,
} from "lucide-react";

const STATE_LABELS: Record<EventStatus, string> = {
  pending_approval: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  waiting_for_payment: "Waiting for Payment",
  payment_done: "Payment Done",
  live: "Live",
  closed: "Closed",
};

const STATE_COLORS: Record<EventStatus, string> = {
  pending_approval: "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  waiting_for_payment: "bg-orange-100 text-orange-700 border-orange-200",
  payment_done: "bg-indigo-100 text-indigo-700 border-indigo-200",
  live: "bg-green-100 text-green-700 border-green-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 sm:w-44 shrink-0">
        {label}
      </span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}

const WORKFLOW_STEPS: { key: EventStatus; label: string; getDesc: (event: OrganizerEvent) => string }[] = [
  { key: "pending_approval", label: "Request Submitted", getDesc: () => "Awaiting admin review" },
  {
    key: "waiting_for_payment",
    label: "Admin Approved",
    getDesc: (e) =>
      e.payment_amount != null
        ? `Payment required: $${e.payment_amount.toFixed(2)}`
        : "Payment required",
  },
  { key: "payment_done", label: "Payment Confirmed", getDesc: () => "Access links generated" },
  { key: "live", label: "Event Live", getDesc: () => "Event is currently running" },
  { key: "closed", label: "Event Closed", getDesc: () => "Event has ended" },
];

const STEP_ORDER: EventStatus[] = [
  "pending_approval",
  "waiting_for_payment",
  "payment_done",
  "live",
  "closed",
];

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params?.id as string;

  const [event, setEvent] = useState<OrganizerEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = async () => {
    try {
      const data = await eventsApi.getEventById(eventId);
      setEvent(data);
    } catch {
      setError("Could not load event details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const handleConfirmPayment = async () => {
    if (
      !confirm(
        "Confirm that payment has been made? This will generate the access links for your event."
      )
    )
      return;
    setPaymentLoading(true);
    setError(null);
    try {
      const updated = await eventsApi.confirmPayment(eventId);
      setEvent(updated);
    } catch (err: any) {
      setError(err.message || "Payment confirmation failed.");
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Event not found.</p>
        <Link
          href="/organizer/events"
          className="text-indigo-600 text-sm mt-2 inline-block"
        >
          Back to events
        </Link>
      </div>
    );
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const currentIdx = STEP_ORDER.indexOf(event.state as EventStatus);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/organizer/events">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATE_COLORS[event.state]}`}
        >
          {STATE_LABELS[event.state]}
        </span>
        {(event.state === "live" || event.state === "closed") && (
          <Link
            href={`/organizer/events/${event.id}/analytics`}
            className="ml-auto"
          >
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart2 className="w-4 h-4" /> View Analytics
            </Button>
          </Link>
        )}
      </div>

      <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Rejection notice */}
      {event.state === "rejected" && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex gap-2 text-sm text-red-700">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Your request was rejected. </span>
            {event.rejection_reason && (
              <span>Reason: {event.rejection_reason}</span>
            )}
          </div>
        </div>
      )}

      {/* Workflow steps */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-4 h-4" /> Approval Workflow
        </h2>
        <ol className="relative border-l-2 border-gray-200 ml-3 space-y-5 pb-1">
          {WORKFLOW_STEPS.map((step) => {
            const stepIdx = STEP_ORDER.indexOf(step.key);
            const isDone = currentIdx > stepIdx;
            const isCurrent =
              currentIdx === stepIdx && event.state !== "rejected";
            return (
              <li key={step.key} className="ml-5">
                <span
                  className={`absolute -left-[11px] w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${isDone ? "bg-green-500 border-green-500" : isCurrent ? "bg-indigo-600 border-indigo-600" : "bg-white border-gray-300"}`}
                >
                  {isDone && <Check className="w-3 h-3 text-white" />}
                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-white" />
                  )}
                </span>
                <div
                  className={
                    isCurrent
                      ? "font-semibold text-gray-900"
                      : isDone
                        ? "text-gray-700"
                        : "text-gray-400"
                  }
                >
                  {step.label}
                  <div
                    className={`text-xs mt-0.5 ${isCurrent ? "text-indigo-600" : isDone ? "text-gray-500" : "text-gray-300"}`}
                  >
                    {step.getDesc(event)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Payment banner */}
      {event.state === "waiting_for_payment" && (
        <Card className="p-5 border-orange-200 bg-orange-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-orange-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Payment Required
              </div>
              <p className="text-sm text-orange-700 mt-1">
                Your event has been approved. Please complete payment of{" "}
                <span className="font-bold text-orange-900">
                  ${event.payment_amount?.toFixed(2)}
                </span>{" "}
                to receive your access links.
              </p>
              {event.num_enterprises && (
                <p className="text-xs text-orange-600 mt-1">
                  Amount calculated from {event.num_enterprises} enterprises
                  across the event duration.
                </p>
              )}
            </div>
            <Button
              className="bg-orange-500 hover:bg-orange-600 shrink-0"
              isLoading={paymentLoading}
              onClick={handleConfirmPayment}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Confirm Payment
            </Button>
          </div>
        </Card>
      )}

      {/* Access links */}
      {(event.enterprise_link || event.visitor_link) && (
        <Card className="p-5 border-indigo-200 bg-indigo-50">
          <h2 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Access Links
          </h2>
          <div className="space-y-4">
            {event.enterprise_link && (
              <div>
                <div className="text-xs font-semibold uppercase text-indigo-600 mb-1">
                  Enterprise Link
                </div>
                <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {baseUrl}{event.enterprise_link}
                  </span>
                  <CopyButton text={`${baseUrl}${event.enterprise_link}`} />
                </div>
                <p className="text-xs text-indigo-600 mt-1">
                  Share with enterprises to let them register and set up their stands.
                </p>
              </div>
            )}
            {event.visitor_link && (
              <div>
                <div className="text-xs font-semibold uppercase text-indigo-600 mb-1">
                  Visitor Link
                </div>
                <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {baseUrl}{event.visitor_link}
                  </span>
                  <CopyButton text={`${baseUrl}${event.visitor_link}`} />
                </div>
                <p className="text-xs text-indigo-600 mt-1">
                  Share publicly to allow visitors to register for the event.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Event details */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Event Details
        </h2>
        <div className="space-y-1">
          <InfoRow label="Description" value={event.description} />
          <InfoRow label="Category" value={event.category} />
          <InfoRow label="Location" value={event.location} />
          <InfoRow
            label="Start Date"
            value={
              event.start_date
                ? new Date(event.start_date).toLocaleString()
                : undefined
            }
          />
          <InfoRow
            label="End Date"
            value={
              event.end_date
                ? new Date(event.end_date).toLocaleString()
                : undefined
            }
          />
          <InfoRow
            label="Enterprises"
            value={event.num_enterprises?.toString()}
          />
          <InfoRow
            label="Tags"
            value={event.tags?.length ? event.tags.join(", ") : undefined}
          />
        </div>
      </Card>

      {/* Request details */}
      {(event.extended_details ||
        event.event_timeline ||
        event.additional_info) && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Request Details
          </h2>
          <div className="space-y-4">
            {event.extended_details && (
              <div>
                <div className="text-xs font-semibold uppercase text-gray-400 mb-1">
                  Extended Details
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {event.extended_details}
                </p>
              </div>
            )}
            {event.event_timeline && (
              <div>
                <div className="text-xs font-semibold uppercase text-gray-400 mb-1">
                  Event Timeline
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {event.event_timeline}
                </p>
              </div>
            )}
            {event.additional_info && (
              <div>
                <div className="text-xs font-semibold uppercase text-gray-400 mb-1">
                  Additional Information
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {event.additional_info}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
