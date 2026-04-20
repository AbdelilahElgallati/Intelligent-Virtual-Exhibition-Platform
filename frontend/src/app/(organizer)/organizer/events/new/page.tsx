'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { eventsApi } from '@/lib/api/events';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { ScheduleBuilder } from '@/components/ui/ScheduleBuilder';
import { EventScheduleDay } from '@/types/event';
import { ArrowLeft, FileText, Users, CalendarDays, Info, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { zonedToUtc } from '@/lib/timezone';
import { useTranslation } from 'react-i18next';

const CATEGORIES = ['Exhibition', 'Conference', 'Webinar', 'Networking', 'Workshop', 'Hackathon'];
const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FALLBACK_TIMEZONES = [
    'UTC',
    'Africa/Casablanca',
    'Europe/Paris',
    'Europe/London',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Dubai',
    'Asia/Tokyo',
];

const SUPPORTED_TIMEZONES =
    typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function'
        ? (Intl.supportedValuesOf('timeZone') as string[])
        : FALLBACK_TIMEZONES;

const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export default function NewEventRequestPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        title: '',
        description: '',
        category: 'Exhibition',
        start_date: '',   // YYYY-MM-DD (date only)
        end_date: '',     // YYYY-MM-DD (date only)
        event_timezone: LOCAL_TIMEZONE,
        location: 'Virtual Platform',
        tags: '',
        banner_url: '',
        num_enterprises: '',
        extended_details: '',
        additional_info: '',
        // Pricing
        stand_price: '',
        is_paid: false,
        ticket_price: '',
    });

    // Structured schedule — driven by date range
    const [scheduleDays, setScheduleDays] = useState<EventScheduleDay[]>([]);

    const getDatePartsInTimezone = (value: Date, timeZone: string) => {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(value);
        const read = (type: Intl.DateTimeFormatPartTypes): number => {
            const raw = parts.find((p) => p.type === type)?.value;
            return Number(raw || 0);
        };
        return {
            year: read('year'),
            month: read('month'),
            day: read('day'),
            hour: read('hour'),
            minute: read('minute'),
        };
    };

    const getTodayIsoInTimezone = (timeZone: string): string => {
        const nowParts = getDatePartsInTimezone(new Date(), timeZone);
        return `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`;
    };

    const getNowMinutesInTimezone = (timeZone: string): number => {
        const nowParts = getDatePartsInTimezone(new Date(), timeZone);
        return nowParts.hour * 60 + nowParts.minute;
    };

    const getNowHhMmInTimezone = (timeZone: string): string => {
        const minutes = Math.min(getNowMinutesInTimezone(timeZone) + 1, 23 * 60 + 59);
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setForm((prev) => ({ ...prev, [name]: checked }));
        } else {
            setForm((prev) => ({ ...prev, [name]: value }));
        }
    };

    const validateSchedule = (): string | null => {
        if (!form.start_date || !form.end_date) return t('organizer.newEvent.validation.dateRequired');
        if (scheduleDays.length === 0) return t('organizer.newEvent.validation.scheduleEmpty');
        const tz = form.event_timezone || 'UTC';
        const todayIso = getTodayIsoInTimezone(tz);
        const nowMinutes = getNowMinutesInTimezone(tz);
        for (const day of scheduleDays) {
            if (day.slots.length === 0) return t('organizer.newEvent.validation.daySlotsRequired', { N: day.day_number });
            for (const slot of day.slots) {
                if (!slot.start_time || !slot.end_time) return t('organizer.newEvent.validation.daySlotsTimeMissing', { N: day.day_number });
                if (!TIME_24H_REGEX.test(slot.start_time) || !TIME_24H_REGEX.test(slot.end_time)) {
                    return t('organizer.newEvent.validation.daySlotsFormatInvalid', { N: day.day_number });
                }
                const [startH, startM] = slot.start_time.split(':').map(Number);
                const [endH, endM] = slot.end_time.split(':').map(Number);
                const startMinutes = startH * 60 + startM;
                const endMinutes = endH * 60 + endM;
                if (startMinutes === endMinutes) {
                    return t('organizer.newEvent.validation.daySlotsIdentical', { N: day.day_number });
                }
                if (form.start_date === todayIso && day.day_number === 1) {
                    const slotStartMinutes = startH * 60 + startM;
                    if (slotStartMinutes < nowMinutes) {
                        return t('organizer.newEvent.validation.dayOneSlotPast', { time: slot.start_time });
                    }
                }
                if (!slot.label.trim()) return t('organizer.newEvent.validation.daySlotDescriptionMissing', { N: day.day_number, start: slot.start_time, end: slot.end_time });
            }
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!form.title.trim()) { setError(t('organizer.newEvent.validation.titleRequired')); return; }
        if (!form.num_enterprises || parseInt(form.num_enterprises) < 1) {
            setError(t('organizer.newEvent.validation.enterprisesMin')); return;
        }
        if (form.stand_price === '' || parseFloat(form.stand_price) < 0) {
            setError(t('organizer.newEvent.validation.standPriceRequired')); return;
        }
        if (form.is_paid && (form.ticket_price === '' || parseFloat(form.ticket_price) < 0)) {
            setError(t('organizer.newEvent.validation.ticketPriceRequired')); return;
        }
        if (form.start_date && form.end_date && form.start_date > form.end_date) {
            setError(t('organizer.newEvent.validation.endDateInvalid')); return;
        }
        const todayInEventTz = getTodayIsoInTimezone(form.event_timezone || 'UTC');
        if (form.start_date && form.start_date < todayInEventTz) {
            setError(t('organizer.newEvent.validation.startDatePast')); return;
        }
        const schedErr = validateSchedule();
        if (schedErr) { setError(schedErr); return; }
        if (!form.extended_details.trim() || form.extended_details.trim().length < 10) {
            setError(t('organizer.newEvent.validation.extendedDetailsRequired')); return;
        }

        setSaving(true);
        try {
            let resolvedBannerUrl = form.banner_url.trim() || undefined;

            // Upload selected banner only when the organizer submits the full event request.
            if (pendingBannerFile) {
                const uploaded = await eventsApi.uploadEventBanner(pendingBannerFile);
                resolvedBannerUrl = uploaded.banner_url || resolvedBannerUrl;
            }

            const timelineJson = JSON.stringify(scheduleDays);

            const timeZone = form.event_timezone || 'UTC';
            const startUtc = zonedToUtc(`${form.start_date}T00:00:00`, timeZone);
            const endUtc = zonedToUtc(`${form.end_date}T23:59:59`, timeZone);

            const payload = {
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                category: form.category || undefined,
                start_date: startUtc.toISOString(),
                end_date: endUtc.toISOString(),
                event_timezone: timeZone,
                location: form.location.trim() || undefined,
                banner_url: resolvedBannerUrl,
                tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
                num_enterprises: parseInt(form.num_enterprises),
                event_timeline: timelineJson,
                schedule_days: scheduleDays,
                extended_details: form.extended_details.trim(),
                additional_info: form.additional_info.trim() || undefined,
                // Pricing
                stand_price: parseFloat(form.stand_price),
                is_paid: form.is_paid,
                ticket_price: form.is_paid && form.ticket_price ? parseFloat(form.ticket_price) : undefined,
            };
            console.log("EVENT PAYLOAD SENT:", JSON.stringify(payload, null, 2));
            await eventsApi.createEvent(payload);
            router.push('/organizer/events');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t('organizer.newEvent.validation.submitFailed');
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const handleBannerUpload = async (file?: File) => {
        if (!file) return;
        setPendingBannerFile(file);
        setError(null);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/organizer/events">
                    <Button variant="outline" size="sm" className="gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        {t('organizer.newEvent.buttons.back')}
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('organizer.newEvent.title')}</h1>
                    <p className="text-gray-500 text-sm">
                        {t('organizer.newEvent.subtitle')}
                    </p>
                </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-sm text-indigo-700 flex gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                    {t('organizer.newEvent.infoBanner')}
                </span>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* ── Basic Information ─────────────────────────────── */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                            <FileText className="w-4 h-4" /> {t('organizer.newEvent.sections.basicInfo')}
                        </h2>
                        <Input label={t('organizer.newEvent.labels.eventTitle')} name="title" placeholder={t('organizer.newEvent.placeholders.eventTitle')} value={form.title} onChange={handleChange} required />
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">{t('organizer.newEvent.labels.description')}</label>
                            <textarea name="description" rows={3} placeholder={t('organizer.newEvent.placeholders.description')} value={form.description} onChange={handleChange} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">{t('organizer.newEvent.labels.category')}</label>
                            <select name="category" value={form.category} onChange={handleChange} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{t(`organizer.newEvent.categories.${cat.toLowerCase()}`)}</option>))}
                            </select>
                        </div>

                        {/* Date-only pickers */}
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label={t('organizer.newEvent.labels.startDate')}
                                name="start_date"
                                type="date"
                                value={form.start_date}
                                onChange={handleChange}
                                min={getTodayIsoInTimezone(form.event_timezone || 'UTC')}
                                required
                            />
                            <Input
                                label={t('organizer.newEvent.labels.endDate')}
                                name="end_date"
                                type="date"
                                value={form.end_date}
                                onChange={handleChange}
                                min={form.start_date || undefined}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">{t('organizer.newEvent.labels.timezone')}</label>
                            <select
                                name="event_timezone"
                                value={form.event_timezone}
                                onChange={handleChange}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {SUPPORTED_TIMEZONES.map((tz) => (
                                    <option key={tz} value={tz}>{tz}</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500">{t('organizer.newEvent.labels.timezoneHint')}</p>
                        </div>
                        {form.start_date && form.end_date && form.start_date <= form.end_date && (
                            <p className="text-xs text-indigo-600 flex items-center gap-1">
                                <CalendarDays className="w-3.5 h-3.5" />
                                {t('organizer.newEvent.labels.daysGenerated', { count: scheduleDays.length })}
                            </p>
                        )}

                        <Input label={t('organizer.newEvent.labels.location')} name="location" placeholder={t('organizer.newEvent.placeholders.category')} value={form.location} onChange={handleChange} />
                        <Input label={t('organizer.newEvent.labels.tags')} name="tags" placeholder={t('organizer.newEvent.placeholders.tags')} value={form.tags} onChange={handleChange} />
                        <div className="space-y-2">
                            <Input
                                label={t('organizer.newEvent.labels.bannerImage')}
                                name="banner_url"
                                type="text"
                                placeholder={t('organizer.newEvent.placeholders.bannerUrl')}
                                value={form.banner_url}
                                onChange={handleChange}
                            />
                            <div className="flex items-center gap-2">
                                <input
                                    ref={bannerInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleBannerUpload(e.target.files?.[0])}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => bannerInputRef.current?.click()}
                                >
                                    {t('organizer.newEvent.labels.uploadBanner')}
                                </Button>
                                <span className="text-xs text-gray-500">
                                    {pendingBannerFile
                                        ? t('organizer.newEvent.labels.selectedFile', { filename: pendingBannerFile.name })
                                        : t('organizer.newEvent.labels.fileHint')}
                                </span>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* ── Participation Details ──────────────────────────── */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                            <Users className="w-4 h-4" /> {t('organizer.newEvent.sections.participationDetails')}
                        </h2>
                        <Input label={t('organizer.newEvent.labels.numEnterprises')} name="num_enterprises" type="number" min="1" placeholder={t('organizer.newEvent.placeholders.numEnterprises')} value={form.num_enterprises} onChange={handleChange} required />
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">{t('organizer.newEvent.labels.extendedDetails')}</label>
                            <textarea name="extended_details" rows={4} placeholder={t('organizer.newEvent.placeholders.extendedDetails')} value={form.extended_details} onChange={handleChange} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" required />
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* ── Pricing ───────────────────────────────────────── */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                            <DollarSign className="w-4 h-4" /> {t('organizer.newEvent.sections.pricing')}
                        </h2>

                        {/* Stand price */}
                        <Input
                            label={t('organizer.newEvent.labels.standPrice')}
                            name="stand_price"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder={t('organizer.newEvent.placeholders.standPrice')}
                            value={form.stand_price}
                            onChange={handleChange}
                            required
                        />
                        <p className="text-xs text-gray-500 -mt-2">
                            {t('organizer.newEvent.labels.standPriceHint')}
                        </p>

                        {/* Event type: free / paid */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700">{t('organizer.newEvent.labels.eventType')}</label>
                            <div className="flex gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="is_paid_radio"
                                        checked={!form.is_paid}
                                        onChange={() => setForm(p => ({ ...p, is_paid: false, ticket_price: '' }))}
                                        className="accent-indigo-600"
                                    />
                                    <span className="text-sm text-gray-700">{t('organizer.newEvent.labels.eventTypeFree')}</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="is_paid_radio"
                                        checked={form.is_paid}
                                        onChange={() => setForm(p => ({ ...p, is_paid: true }))}
                                        className="accent-indigo-600"
                                    />
                                    <span className="text-sm text-gray-700">{t('organizer.newEvent.labels.eventTypePaid')}</span>
                                </label>
                            </div>
                        </div>

                        {/* Ticket price — only shown when paid */}
                        {form.is_paid && (
                            <div className="pl-4 border-l-2 border-indigo-100 space-y-1">
                                <Input
                                    label={t('organizer.newEvent.labels.visitorPrice')}
                                    name="ticket_price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder={t('organizer.newEvent.placeholders.ticketPrice')}
                                    value={form.ticket_price}
                                    onChange={handleChange}
                                    required
                                />
                                <p className="text-xs text-gray-500">{t('organizer.newEvent.labels.visitorPriceHint')}</p>
                            </div>
                        )}
                    </div>

                    <hr className="border-gray-100" />

                    {/* ── Schedule Builder ──────────────────────────────── */}
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2 mb-0.5">
                                <CalendarDays className="w-4 h-4" /> {t('organizer.newEvent.sections.schedule')}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {t('organizer.newEvent.labels.scheduleDescription')}
                            </p>
                            <p className="text-xs text-indigo-600 mt-1">{t('organizer.newEvent.labels.scheduleHint')}</p>
                        </div>

                        <ScheduleBuilder
                            days={scheduleDays}
                            onChange={setScheduleDays}
                            startDate={form.start_date}
                            endDate={form.end_date}
                            minStartTimeForDay1={
                                form.start_date === getTodayIsoInTimezone(form.event_timezone || 'UTC')
                                    ? getNowHhMmInTimezone(form.event_timezone || 'UTC')
                                    : undefined
                            }
                        />
                    </div>

                    <hr className="border-gray-100" />

                    {/* ── Additional Info ───────────────────────────────── */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">{t('organizer.newEvent.sections.additionalInfo')} <span className="text-gray-400">{t('organizer.newEvent.sections.additionalInfoOptional')}</span></label>
                        <textarea name="additional_info" rows={3} placeholder={t('organizer.newEvent.labels.additionalInfoPlaceholder')} value={form.additional_info} onChange={handleChange} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button type="submit" isLoading={saving} className="bg-indigo-600 hover:bg-indigo-700">
                            {t('organizer.newEvent.buttons.submit')}
                        </Button>
                        <Link href="/organizer/events">
                            <Button type="button" variant="outline">{t('organizer.eventDetail.buttons.cancel')}</Button>
                        </Link>
                    </div>
                </form>
            </Card>
        </div>
    );
}
