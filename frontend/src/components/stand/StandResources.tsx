'use client';

import { useState, useEffect } from 'react';
import { Resource } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText, Film, Download } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';

interface StandResourcesProps {
    standId: string;
}

export function StandResources({ standId }: StandResourcesProps) {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchResources = async () => {
            try {
                const data = await apiClient.get<Resource[]>(ENDPOINTS.RESOURCES.LIST(standId));
                setResources(data);
            } catch (error) {
                console.error('Failed to fetch resources', error);
            } finally {
                setLoading(false);
            }
        };
        fetchResources();
    }, [standId]);

    if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-lg"></div>;

    if (resources.length === 0) {
        return (
            <Card className="p-6 text-center text-gray-500 bg-gray-50 border-dashed">
                <p>No resources available yet.</p>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {resources.map((resource, idx) => (
                <div
                    key={resource.id || (resource as any)._id || idx}
                    className="group relative flex flex-col p-5 rounded-3xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.05)] hover:bg-white/90 hover:shadow-[0_12px_48px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-1"
                >
                    <div className="flex items-start space-x-4 mb-4">
                        <div className="p-3 bg-black/5 rounded-2xl text-gray-700 transition-colors group-hover:bg-black/10">
                            {resource.type === 'video' ? (
                                <Film className="w-5 h-5" />
                            ) : (
                                <FileText className="w-5 h-5" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-black text-gray-900 text-sm leading-tight mb-1 truncate uppercase tracking-tight">
                                {resource.title}
                            </h4>
                            <div className="text-[10px] font-black text-gray-400 flex items-center gap-2 uppercase tracking-widest">
                                <span className="px-1.5 py-0.5 rounded bg-black/5">{resource.type || 'file'}</span>
                                <span>{Math.round(resource.file_size / 1024)} KB</span>
                            </div>
                        </div>
                    </div>

                    {resource.description && (
                        <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-2 mb-4">
                            {resource.description}
                        </p>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-black/5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                            {resource.downloads} downloads
                        </span>
                        <a
                            href={resolveMediaUrl(resource.file_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg shadow-black/10"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Download
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
}
