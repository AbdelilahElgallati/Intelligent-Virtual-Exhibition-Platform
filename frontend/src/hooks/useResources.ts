import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resourcesApi } from '../services/resourcesApi';

export const useResources = (standId?: string) => {
    const queryClient = useQueryClient();

    const catalogQuery = useQuery({
        queryKey: ['resources', standId],
        queryFn: () => resourcesApi.getStandCatalog(standId!),
        enabled: !!standId,
    });

    const uploadMutation = useMutation({
        mutationFn: ({ title, type, file, description }: { title: string, type: string, file: File, description?: string }) =>
            resourcesApi.uploadResource(standId!, title, type, file, description),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['resources', standId] });
        },
    });

    const trackDownload = async (resourceId: string) => {
        try {
            await resourcesApi.trackDownload(resourceId);
        } catch (err) {
            console.error('Failed to track download', err);
        }
    };

    return {
        resources: catalogQuery.data || [],
        isLoading: catalogQuery.isLoading,
        upload: uploadMutation.mutateAsync,
        isUploading: uploadMutation.isPending,
        trackDownload
    };
};
