'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Stand } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Container } from '@/components/common/Container';
import { LoadingState } from '@/components/ui/LoadingState';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StandResources } from '@/components/stand/StandResources';
import { ArrowLeft, Building2, MessageSquare, CalendarDays, Info } from 'lucide-react';

export default function StandPage({ params }: { params: Promise<{ id: string; standId: string }> }) {
    const { id, standId } = use(params);
    const [stand, setStand] = useState<Stand | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'resources' | 'about'>('resources');

    useEffect(() => {
        const fetchStand = async () => {
            try {
                const data = await apiClient.get<Stand>(ENDPOINTS.STANDS.GET(id, standId));
                setStand(data);

                // Track visit
                try {
                    await apiClient.post('/analytics/log', {
                        type: 'stand_visit',
                        event_id: id,
                        stand_id: standId,
                    });
                } catch (e) {
                    // ignore
                }
            } catch (error) {
                console.error('Failed to fetch stand', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStand();
    }, [id, standId]);

    if (loading) return <LoadingState message="Loading stand..." />;
    if (!stand) return <div className="text-center py-20 text-gray-500">Stand not found</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white border-b border-gray-200">
                <Container className="py-8">
                    <Link href={`/events/${id}/live?tab=stands`} className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600 mb-6">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Event
                    </Link>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Logo / Image */}
                        <div className="w-32 h-32 md:w-48 md:h-48 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center border border-indigo-100 text-indigo-400 shrink-0">
                            {stand.logo_url ? (
                                <img src={stand.logo_url} alt={stand.name} className="w-full h-full object-cover rounded-xl" />
                            ) : (
                                <Building2 className="w-16 h-16" />
                            )}
                        </div>

                        {/* Stand Info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-gray-900">{stand.name}</h1>
                                {stand.stand_type === 'sponsor' && (
                                    <Badge variant="warning">SPONSOR</Badge>
                                )}
                            </div>

                            <p className="text-lg text-gray-600 mb-4 max-w-2xl">
                                {stand.description || "Welcome to our virtual stand. Explore our resources and connect with our team."}
                            </p>

                            <div className="flex flex-wrap gap-2 mb-6">
                                {stand.tags?.map((tag, idx) => (
                                    <Badge key={idx} variant="default" className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Button className="bg-indigo-600 hover:bg-indigo-700">
                                    <MessageSquare className="w-5 h-5 mr-2" />
                                    Chat with Team
                                </Button>
                                <Button variant="outline">
                                    <CalendarDays className="w-5 h-5 mr-2" />
                                    Request Meeting
                                </Button>
                                <Button variant="outline">
                                    <Info className="w-5 h-5 mr-2" />
                                    Ask Assistant
                                </Button>
                            </div>
                        </div>
                    </div>
                </Container>

                {/* Tabs */}
                <Container>
                    <div className="flex space-x-8 mt-8 -mb-px">
                        <button
                            onClick={() => setActiveTab('resources')}
                            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'resources'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                }`}
                        >
                            Resources
                        </button>
                        <button
                            onClick={() => setActiveTab('about')}
                            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'about'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                }`}
                        >
                            About
                        </button>
                    </div>
                </Container>
            </div>

            <Container className="py-8">
                {activeTab === 'resources' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            <h3 className="text-lg font-bold text-gray-900">Documents & Videos</h3>
                            <StandResources standId={standId} />
                        </div>
                        <div>
                            <Card className="p-6 bg-indigo-50 border-indigo-100">
                                <h4 className="font-bold text-indigo-900 mb-2">Recommended for You</h4>
                                <p className="text-sm text-indigo-700 mb-4">
                                    Based on your profile, this stand matches your interest in <strong>AI Technology</strong>.
                                </p>
                            </Card>
                        </div>
                    </div>
                )}

                {activeTab === 'about' && (
                    <Card className="p-8">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">About Us</h3>
                        <p className="text-gray-600 leading-relaxed">
                            {stand.description || "Company description coming soon."}
                        </p>
                    </Card>
                )}
            </Container>
        </div>
    );
}
