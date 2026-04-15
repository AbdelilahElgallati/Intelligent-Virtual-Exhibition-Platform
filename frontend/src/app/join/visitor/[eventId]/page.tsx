"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { useAuth } from "@/context/AuthContext";

type InviteState = "loading" | "success" | "error";

export default function VisitorInviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, user } = useAuth();

  const eventId = params?.eventId as string;
  const token = searchParams.get("token") || "";

  const [state, setState] = useState<InviteState>("loading");
  const [message, setMessage] = useState("Processing your invite...");

  useEffect(() => {
    const acceptInvite = async () => {
      if (!eventId) {
        setState("error");
        setMessage("Missing event identifier in the invite link.");
        return;
      }

      if (isLoading) {
        return;
      }

      const currentPathWithQuery = token
        ? `/join/visitor/${eventId}?token=${encodeURIComponent(token)}`
        : `/join/visitor/${eventId}`;

      if (!isAuthenticated) {
        localStorage.setItem("redirectAfterLogin", currentPathWithQuery);
        router.replace("/auth/login");
        return;
      }

      if (user?.role && user.role !== "visitor") {
        setState("error");
        setMessage("This invite is for visitor accounts. Please log in with a visitor account.");
        return;
      }

      try {
        await apiClient.post(ENDPOINTS.EVENTS.ACCEPT_VISITOR_INVITE(eventId, token || undefined));
        setState("success");
        setMessage("You are now accepted as a guest visitor for this event.");
      } catch (err: unknown) {
        setState("error");
        const errorMessage = err instanceof Error ? err.message : "Could not accept the invite. It may be invalid or expired.";
        setMessage(errorMessage);
      }
    };

    acceptInvite();
  }, [eventId, token, isAuthenticated, isLoading, router, user?.role]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Visitor Invite</h1>
        <p className="mt-2 text-sm text-zinc-600">{message}</p>

        {state === "loading" && (
          <div className="mt-6 h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
            <div className="h-full w-1/2 animate-pulse bg-indigo-500" />
          </div>
        )}

        {state === "success" && (
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/events/${eventId}`}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Go to Event Page
            </Link>
            <Link
              href={`/events/${eventId}/live`}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Enter Live Experience
            </Link>
          </div>
        )}

        {state === "error" && (
          <div className="mt-6">
            <Link
              href={eventId ? `/events/${eventId}` : "/events"}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Back to Events
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
