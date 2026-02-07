import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi } from '../services/meetingsApi';

export const useMeetings = () => {
    const queryClient = useQueryClient();

    const useMyMeetings = () => useQuery({
        queryKey: ['meetings', 'my'],
        queryFn: meetingsApi.getMyMeetings,
    });

    const useStandMeetings = (standId: string) => useQuery({
        queryKey: ['meetings', 'stand', standId],
        queryFn: () => meetingsApi.getStandMeetings(standId),
        enabled: !!standId,
    });

    const requestMutation = useMutation({
        mutationFn: meetingsApi.requestMeeting,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, update }: { id: string, update: any }) =>
            meetingsApi.updateMeetingStatus(id, update),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
        },
    });

    return {
        useMyMeetings,
        useStandMeetings,
        requestMeeting: requestMutation.mutateAsync,
        updateMeetingStatus: updateStatusMutation.mutateAsync,
        isRequesting: requestMutation.isPending,
        isUpdating: updateStatusMutation.isPending,
    };
};
