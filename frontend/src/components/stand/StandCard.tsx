'use client';

import Link from 'next/link';
import { Stand } from '@/lib/api/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowRight, Building2 } from 'lucide-react';

interface StandCardProps {
    stand: Stand;
}

export function StandCard({ stand }: StandCardProps) {
    const standId = (stand as any).id || (stand as any)._id;
    return (
        <Card className="h-full flex flex-col hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group border-gray-200">
            <div className="p-6 flex-1 flex flex-col">
                {/* Header / Logo Area */}
                <div className="flex items-start justify-between mb-4">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center border border-indigo-100 text-indigo-600 shadow-sm group-hover:shadow-md transition-shadow">
                        {stand.logo_url ? (
                            <img
                                src={stand.logo_url}
                                alt={stand.name}
                                className="w-full h-full object-cover rounded-lg"
                            />
                        ) : (
                            <Building2 className="w-8 h-8" />
                        )}
                    </div>
                    {stand.stand_type === 'sponsor' && (
                        <Badge variant="warning" className="uppercase text-[10px] tracking-wider">
                            Sponsor
                        </Badge>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2 line-clamp-1">
                        {stand.name}
                    </h3>

                    <div className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[2.5rem]">
                        {stand.description || "Visit our stand to learn about our premium solutions and connect with our team."}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {stand.tags?.slice(0, 3).map((tag, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer / Action */}
            <div className="p-6 pt-0 mt-auto">
                <Link href={`/events/${stand.event_id}/stands/${standId}`} passHref className="w-full">
                    <Button
                        variant="outline"
                        className="w-full group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all"
                    >
                        Visit Stand
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </Link>
            </div>
        </Card>
    );
}
