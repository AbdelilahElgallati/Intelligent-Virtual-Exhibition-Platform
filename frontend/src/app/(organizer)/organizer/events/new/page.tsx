'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { eventsApi } from '@/lib/api/events';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { ArrowLeft, FileText, Users, CalendarDays, Info } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = ['Exhibition', 'Conference', 'Webinar', 'Networking', 'Workshop', 'Hackathon'];

export default function NewEventRequestPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        title: '',
        description: '',
        category: 'Exhibition',
        start_date: '',
        end_date: '',
        location: 'Virtual Platform',
        organizer_name: '',
        tags: '',
        banner_url: '',
        num_enterprises: '',
        event_timeline: '',
        extended_details: '',
        additional_info: '',
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!form.title.trim()) { setError('Event title is required.'); return; }
        if (!form.num_enterprises || parseInt(form.num_enterprises) < 1) {
            setError('Number of participating enterprises must be at least 1.'); return;
        }
        if (!form.event_timeline.trim() || form.event_timeline.trim().length < 10) {
            setError('Event timeline is required (at least 10 characters).'); return;
        }
        if (!form.extended_details.trim() || form.extended_details.trim().length < 10) {
            setError('Extended event details are required (at least 10 characters).'); return;
        }
        if (form.start_date && form.end_date && form.start_date > form.end_date) {
            setError('End date must be after start date.'); return;
        }

        setSaving(true);
        try {
            await eventsApi.createEvent({
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                category: form.category || undefined,
                start_date: form.start_date || undefined,
                end_date: form.end_date || undefined,
                location: form.location.trim() || undefined,
                organizer_name: form.organizer_name.trim() || undefined,
                banner_url: form.banner_url.trim() || undefined,
                tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
                num_enterprises: parseInt(form.num_enterprises),
                event_timeline: form.event_timeline.trim(),
                extended_details: form.extended_details.trim(),
                additional_info: form.additional_info.trim() || undefined,
            });
            router.push('/organizer/events');
        } catch (err: any) {
            setError(err.message || 'Failed to submit event request. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/organizer/events">
                    <Button variant="outline" size="sm" className="gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Submit Event Request</h1>
                    <p className="text-gray-500 text-sm">
                        Fill in the details below. Your request will be reviewed by an administrator.
                    </p>
                </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-sm text-indigo-700 flex gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                    Once submitted, an admin will review your request. If approved, you will receive a
                    payment invoice. After payment is confirmed, enterprise and visitor access links will be
                    generated automatically.
                </span>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Basic Information
                        </h2>
                        <Input label="Event Title *" name="title" placeholder="e.g. Tech Innovation Expo 2026" value={form.title} onChange={handleChange} required />
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">Description</label>
                            <textarea name="description" rows={3} placeholder="Describe what attendees can expect..." value={form.description} onChange={handleChange} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">Category</label>
                            <select name="category" value={form.category} onChange={handleChange} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Start Date & Time" name="start_date" type="datetime-local" value={form.start_date} onChange={handleChange} />
                            <Input label="End Date & Time" name="end_date" type="datetime-local" value={form.end_date} onChange={handleChange} />
                        </div>
                        <Input label="Location" name="location" placeholder="Virtual Platform" value={form.location} onChange={handleChange} />
                        <Input label="Organizer Display Name" name="organizer_name" placeholder="Your company or organization name" value={form.organizer_name} onChange={handleChange} />
                        <Input label="Tags (comma-separated)" name="tags" placeholder="e.g. AI, Tech, Startup" value={form.tags} onChange={handleChange} />
                        <Input label="Banner Image URL" name="banner_url" type="url" placeholder="https://example.com/banner.jpg" value={form.banner_url} onChange={handleChange} />
                    </div>

                    <hr className="border-gray-100" />

                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                            <Users className="w-4 h-4" /> Participation Details
                        </h2>
                        <Input label="Number of Participating Enterprises *" name="num_enterprises" type="number" min="1" placeholder="e.g. 20" value={form.num_enterprises} onChange={handleChange} required />
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">Extended Event Details *</label>
                            <textarea name="extended_details" rows={4} placeholder="Provide detailed information: objectives, target audience, special features, etc." value={form.extended_details} onChange={handleChange} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" required />
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                            <CalendarDays className="w-4 h-4" /> Event Timeline
                        </h2>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">Precise Event Timeline / Schedule *</label>
                            <textarea name="event_timeline" rows={5} placeholder={"Day 1 (Morning): Opening ceremony & keynotes\nDay 1 (Afternoon): Stand visits & networking\nDay 2: Workshops & panels\nDay 3: Closing ceremony"} value={form.event_timeline} onChange={handleChange} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" required />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">Additional Information <span className="text-gray-400">(optional)</span></label>
                            <textarea name="additional_info" rows={3} placeholder="Any other relevant information for the administrator..." value={form.additional_info} onChange={handleChange} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button type="submit" isLoading={saving} className="bg-indigo-600 hover:bg-indigo-700">
                            Submit Event Request
                        </Button>
                        <Link href="/organizer/events">
                            <Button type="button" variant="outline">Cancel</Button>
                        </Link>
                    </div>
                </form>
            </Card>
        </div>
    );
}
