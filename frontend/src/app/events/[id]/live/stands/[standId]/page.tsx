"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";

export default function LiveStandPage() {
	const { t } = useTranslation();
	const params = useParams<{ id: string; standId: string }>();
	const eventId = params?.id;

	return (
		<div className="mx-auto max-w-3xl p-6">
			<div className="rounded-2xl border border-zinc-200 bg-white p-8">
				<h1 className="text-2xl font-bold text-zinc-900">{t('events.liveStandPlaceholder.title')}</h1>
				<p className="mt-2 text-sm text-zinc-600">
					{t('events.liveStandPlaceholder.message')}
				</p>
				<Link
					href={eventId ? `/events/${eventId}/live` : "/events"}
					className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
				>
					{t('events.liveStandPlaceholder.back')}
				</Link>
			</div>
		</div>
	);
}
