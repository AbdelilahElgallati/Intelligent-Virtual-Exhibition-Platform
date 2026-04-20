"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";

type InviteState = "loading" | "success" | "error";

export default function EnterpriseInviteAcceptPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, user } = useAuth();

  const eventId = params?.eventId as string;
  const token = searchParams.get("token") || "";

  const [state, setState] = useState<InviteState>("loading");
  const [message, setMessage] = useState(t("enterprise.inviteAccept.processing"));

  useEffect(() => {
    const acceptInvite = async () => {
      if (!eventId) {
        setState("error");
        setMessage(t("enterprise.inviteAccept.missingEventId"));
        return;
      }

      if (isLoading) {
        return;
      }

      const currentPathWithQuery = token
        ? `/join/enterprise/${eventId}?token=${encodeURIComponent(token)}`
        : `/join/enterprise/${eventId}`;

      if (!isAuthenticated) {
        localStorage.setItem("redirectAfterLogin", currentPathWithQuery);
        router.replace("/auth/login");
        return;
      }

      if (user?.role && user.role !== "enterprise") {
        setState("error");
        setMessage(t("enterprise.inviteAccept.enterpriseOnly"));
        return;
      }

      try {
        await apiClient.post(ENDPOINTS.ENTERPRISE.ACCEPT_INVITE(eventId, token || undefined));
        setState("success");
        setMessage(t("enterprise.inviteAccept.success"));
      } catch (err: unknown) {
        setState("error");
        const errorMessage = err instanceof Error ? err.message : t("enterprise.inviteAccept.error");
        setMessage(errorMessage);
      }
    };

    acceptInvite();
  }, [eventId, token, isAuthenticated, isLoading, router, user?.role, t]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">{t("enterprise.inviteAccept.title")}</h1>
        <p className="mt-2 text-sm text-zinc-600">{message}</p>

        {state === "loading" && (
          <div className="mt-6 h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
            <div className="h-full w-1/2 animate-pulse bg-indigo-500" />
          </div>
        )}

        {state === "success" && (
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/enterprise/events/${eventId}/stand`}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {t("enterprise.inviteAccept.actions.configureStand")}
            </Link>
            <Link
              href="/enterprise/events"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {t("enterprise.inviteAccept.actions.goToEvents")}
            </Link>
          </div>
        )}

        {state === "error" && (
          <div className="mt-6">
            <Link
              href="/enterprise/events"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {t("enterprise.inviteAccept.actions.backToEvents")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
