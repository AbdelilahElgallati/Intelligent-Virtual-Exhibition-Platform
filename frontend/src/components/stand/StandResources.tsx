'use client';

import { useState, useEffect } from 'react';
import { Resource } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText, Film, Download } from 'lucide-react';

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
        <div className="space-y-4">
            {resources.map((resource) => (
                <Card key={resource.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center space-x-4">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            {resource.type === 'video' ? (
                                <Film className="w-6 h-6" />
                            ) : (
                                <FileText className="w-6 h-6" />
                            )}
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900">{resource.title}</h4>
                            {resource.description && (
                                <p className="text-sm text-gray-500">{resource.description}</p>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                                {Math.round(resource.file_size / 1024)} KB • {resource.downloads} downloads
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4" />
                    </Button>
                </Card>
            ))}
        </div>
    );
}
