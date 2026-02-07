import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../services/leadsApi';

export const useLeads = (standId?: string) => {
    const queryClient = useQueryClient();

    const leadsQuery = useQuery({
        queryKey: ['leads', standId],
        queryFn: () => leadsApi.getStandLeads(standId!),
        enabled: !!standId,
    });

    const trackMutation = useMutation({
        mutationFn: leadsApi.trackInteraction,
    });

    const exportMutation = useMutation({
        mutationFn: () => leadsApi.exportLeads(standId!),
    });

    return {
        leads: leadsQuery.data || [],
        isLoading: leadsQuery.isLoading,
        trackInteraction: trackMutation.mutate,
        exportLeads: exportMutation.mutateAsync,
        isExporting: exportMutation.isPending,
    };
};
