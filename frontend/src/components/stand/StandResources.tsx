'use client';

import { useState, useEffect } from 'react';
import { Resource } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Card } from '@/components/ui/Card';
import { FileText, Film, Download, Play, ExternalLink } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';
import { useTranslation } from 'react-i18next';

interface StandResourcesProps {
    standId: string;
}

export function StandResources({ standId }: StandResourcesProps) {
    const { t } = useTranslation();
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
            <Card className="p-6 text-center text-gray-500 bg-gray-50 border-dashed rounded-2xl">
                <p>{t('visitor.standResources.empty')}</p>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {resources.map((resource, idx) => {
                const isExternal = resource.type === 'video_url' || resource.type === 'link';
                const isVideo = resource.type === 'video' || resource.type === 'video_url';

                return (
                    <div
                        key={resource.id || (resource as any)._id || idx}
                        className="group relative flex flex-col p-5 rounded-2xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300"
                    >
                        <div className="flex items-start space-x-4 mb-4">
                            <div className="p-3 bg-gray-100 rounded-xl text-gray-700 border border-gray-200 transition-colors group-hover:bg-gray-200">
                                {isVideo ? (
                                    <Film className="w-5 h-5" />
                                ) : resource.type === 'link' ? (
                                    <ExternalLink className="w-5 h-5" />
                                ) : (
                                    <FileText className="w-5 h-5" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 text-sm leading-tight mb-1 truncate">
                                    {resource.title}
                                </h4>
                                <div className="text-[10px] font-medium text-gray-500 flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">{resource.type || t('visitor.standResources.fileTypeFallback')}</span>
                                    {resource.file_size > 0 && <span>{Math.round(resource.file_size / 1024)} KB</span>}
                                </div>
                            </div>
                        </div>

                        {resource.description && (
                            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4">
                                {resource.description}
                            </p>
                        )}

                        <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
                            <span className="text-[10px] font-medium text-gray-500">
                                {resource.downloads} {isExternal ? t('visitor.standResources.views') : t('visitor.standResources.downloads')}
                            </span>
                            <a
                                href={resolveMediaUrl(resource.file_path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-[11px] font-semibold hover:bg-black transition-all active:scale-95 shadow-md"
                            >
                                {isVideo ? (
                                    <Play className="w-3.5 h-3.5" />
                                ) : isExternal ? (
                                    <ExternalLink className="w-3.5 h-3.5" />
                                ) : (
                                    <Download className="w-3.5 h-3.5" />
                                )}
                                {isVideo ? t('visitor.standResources.watch') : isExternal ? t('visitor.standResources.open') : t('visitor.standResources.download')}
                            </a>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
