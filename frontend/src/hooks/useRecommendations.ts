import { useQuery } from '@tanstack/react-query';
import { recommendationsApi } from '../services/recommendationsApi';

export const useRecommendations = (type: 'user' | 'event' | 'enterprise', id: string) => {
    return useQuery({
        queryKey: ['recommendations', type, id],
        queryFn: () => {
            if (type === 'user') return recommendationsApi.getUserRecs(id);
            if (type === 'event') return recommendationsApi.getEventRecs(id);
            return recommendationsApi.getEnterpriseRecs(id);
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};
