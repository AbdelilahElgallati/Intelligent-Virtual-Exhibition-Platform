import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/analyticsApi';

export const useAnalytics = (scope: 'stand' | 'event' | 'visitor', id: string) => {
    return useQuery({
        queryKey: ['analytics', scope, id],
        queryFn: () => {
            if (scope === 'stand') return analyticsApi.getStandMetrics(id);
            if (scope === 'event') return analyticsApi.getEventMetrics(id);
            return analyticsApi.getVisitorMetrics(id);
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 1, // 1 minute
    });
};
