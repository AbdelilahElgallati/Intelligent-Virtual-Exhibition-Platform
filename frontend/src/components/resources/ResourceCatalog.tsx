import React from 'react';
import { FileText, Video, Image as ImageIcon, Download, FileBox, Tag, MoreVertical } from 'lucide-react';
import { useResources } from '../../hooks/useResources';

interface ResourceCatalogProps {
    standId: string;
}

export const ResourceCatalog: React.FC<ResourceCatalogProps> = ({ standId }) => {
    const { resources, isLoading, trackDownload } = useResources(standId);

    const getFileIcon = (type: string) => {
        switch (type) {
            case 'video': return <Video size={20} className="text-rose-500" />;
            case 'image': return <ImageIcon size={20} className="text-emerald-500" />;
            case 'pdf': return <FileText size={20} className="text-red-500" />;
            default: return <FileBox size={20} className="text-indigo-500" />;
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    if (isLoading) return <div className="p-4 animate-pulse text-gray-400">Loading catalog...</div>;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <header className="p-6 border-b flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Resource Catalog</h3>
                    <p className="text-xs text-gray-500 font-medium">Download relevant materials and media.</p>
                </div>
                <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                            +{i * 10}
                        </div>
                    ))}
                </div>
            </header>

            <div className="divide-y divide-gray-50">
                {resources.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <FileBox size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No resources available for this stand.</p>
                    </div>
                ) : (
                    resources.map((resource: any) => (
                        <div key={resource.id} className="p-4 hover:bg-gray-50/50 transition-colors flex items-center gap-4 group">
                            <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm group-hover:scale-105 transition-transform">
                                {getFileIcon(resource.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-gray-900 truncate mb-0.5">{resource.title}</h4>
                                <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                                    <span className="flex items-center gap-0.5"><Download size={10} /> {resource.downloads} downloads</span>
                                    <span>•</span>
                                    <span>{formatSize(resource.file_size)}</span>
                                    <span>•</span>
                                    <span className="uppercase">{resource.type}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => trackDownload(resource.id)}
                                    className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                                >
                                    <Download size={16} />
                                </button>
                                <button className="p-2 text-gray-300 hover:text-gray-600 transition-colors rounded-lg">
                                    <MoreVertical size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <footer className="p-4 bg-gray-50 flex items-center justify-between">
                <button className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                    <Tag size={12} /> Filter by category
                </button>
                <span className="text-[10px] text-gray-400 font-medium">{resources.length} items total</span>
            </footer>
        </div>
    );
};
