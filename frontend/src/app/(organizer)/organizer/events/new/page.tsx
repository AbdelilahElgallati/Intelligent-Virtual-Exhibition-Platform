'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { eventsApi } from '@/lib/api/events';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = ['Exhibition', 'Conference', 'Webinar', 'Networking', 'Workshop', 'Hackathon'];

export default function NewEventPage() {
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
        tags: '',          // comma-separated raw input
        banner_url: '',
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!form.title.trim()) {
            setError('Title is required.');
            return;
        }

        if (form.start_date && form.end_date && form.start_date > form.end_date) {
            setError('End date must be after start date.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                category: form.category || undefined,
                start_date: form.start_date || undefined,
                end_date: form.end_date || undefined,
                location: form.location.trim() || undefined,
                organizer_name: form.organizer_name.trim() || undefined,
                banner_url: form.banner_url.trim() || undefined,
                tags: form.tags
                    ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
                    : [],
            };

            await eventsApi.createEvent(payload);
            router.push('/organizer/events');
        } catch (err: any) {
            setError(err.message || 'Failed to create event. Please try again.');
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
                    <h1 className="text-2xl font-bold text-gray-900">Create New Event</h1>
                    <p className="text-gray-500 text-sm">Your event starts in DRAFT — submit it for admin approval when ready.</p>
                </div>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <Input
                        label="Event Title *"
                        name="title"
                        placeholder="e.g. Tech Innovation Expo 2026"
                        value={form.title}
                        onChange={handleChange}
                        required
                    />

                    {/* Description */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">Description</label>
                        <textarea
                            name="description"
                            rows={4}
                            placeholder="Describe what attendees can expect..."
                            value={form.description}
                            onChange={handleChange}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>

                    {/* Category */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">Category</label>
                        <select
                            name="category"
                            value={form.category}
                            onChange={handleChange}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Start Date & Time"
                            name="start_date"
                            type="datetime-local"
                            value={form.start_date}
                            onChange={handleChange}
                        />
                        <Input
                            label="End Date & Time"
                            name="end_date"
                            type="datetime-local"
                            value={form.end_date}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Location */}
                    <Input
                        label="Location"
                        name="location"
                        placeholder="Virtual Platform"
                        value={form.location}
                        onChange={handleChange}
                    />

                    {/* Organizer Name */}
                    <Input
                        label="Organizer Display Name"
                        name="organizer_name"
                        placeholder="Your company or organization name"
                        value={form.organizer_name}
                        onChange={handleChange}
                    />

                    {/* Tags */}
                    <Input
                        label="Tags (comma-separated)"
                        name="tags"
                        placeholder="e.g. AI, Tech, Startup"
                        value={form.tags}
                        onChange={handleChange}
                    />

                    {/* Banner URL */}
                    <Input
                        label="Banner Image URL"
                        name="banner_url"
                        type="url"
                        placeholder="https://example.com/banner.jpg"
                        value={form.banner_url}
                        onChange={handleChange}
                    />

                    <div className="flex gap-3 pt-2">
                        <Button type="submit" isLoading={saving} className="bg-indigo-600 hover:bg-indigo-700">
                            Create Event
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
