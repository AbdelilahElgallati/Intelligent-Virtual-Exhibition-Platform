import React from 'react';
import { Calendar, Clock, User, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useMeetings } from '../../hooks/useMeetings';

export const MeetingBookingList: React.FC = () => {
    const { useMyMeetings } = useMeetings();
    const { data: meetings, isLoading, error } = useMyMeetings();

    if (isLoading) return <div className="p-4 animate-pulse text-gray-400">Loading your meetings...</div>;
    if (error) return <div className="p-4 text-rose-500">Error loading meetings</div>;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'rejected': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
            default: return 'bg-gray-50 text-gray-500 border-gray-100';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return <CheckCircle2 size={14} />;
            case 'rejected': return <XCircle size={14} />;
            case 'pending': return <AlertCircle size={14} />;
            default: return null;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-900">Your Appointments</h3>
                <span className="text-xs text-gray-400 font-medium">{meetings?.length || 0} Scheduled</span>
            </div>

            {meetings?.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-100 rounded-2xl p-8 text-center">
                    <Calendar size={32} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400 text-sm">No meetings scheduled yet.</p>
                </div>
            ) : (
                meetings?.map((meeting: any) => (
                    <div
                        key={meeting.id}
                        className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className={`px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${getStatusColor(meeting.status)}`}>
                                {getStatusIcon(meeting.status)}
                                {meeting.status}
                            </div>
                            <div className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                <Calendar size={12} />
                                {new Date(meeting.start_time).toLocaleDateString()}
                            </div>
                        </div>

                        <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-1 truncate">
                            Meeting at Stand #{meeting.stand_id}
                        </h4>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                                <Clock size={12} />
                                {new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                {new Date(meeting.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>

                        {meeting.purpose && (
                            <p className="mt-3 text-xs text-gray-400 italic line-clamp-1 border-t border-gray-50 pt-2">
                                "{meeting.purpose}"
                            </p>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};
