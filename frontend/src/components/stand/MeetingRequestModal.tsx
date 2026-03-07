import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { X, Calendar, Clock, MessageSquare, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface MeetingRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    standId: string;
    standName: string;
}

export function MeetingRequestModal({ isOpen, onClose, standId, standName }: MeetingRequestModalProps) {
    const { user } = useAuth();
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [loading, setLoading] = useState(false);

    // Form State
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [message, setMessage] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const startTime = new Date(`${date}T${time}`);
            const endTime = new Date(startTime.getTime() + 30 * 60000); // Default 30 min duration

            await apiClient.post(ENDPOINTS.MEETINGS.REQUEST, {
                visitor_id: user?._id || (user as any)?.id, // Handle both _id and id
                stand_id: standId,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                purpose: message || "General Inquiry",
            });
            setStep('success');

            // Optional: Send system message to chat if we had access to chat context
            // But for now just success modal is enough.

        } catch (error) {
            console.error("Failed to request meeting", error);
            alert("Failed to send request. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {step === 'form' ? (
                    <>
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900">Request Meeting</h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="date"
                                        required
                                        min={new Date().toISOString().split('T')[0]}
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Time</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="time"
                                        required
                                        value={time}
                                        onChange={e => setTime(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Message (Optional)</label>
                                <textarea
                                    rows={3}
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Briefly describe what you'd like to discuss..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                />
                            </div>

                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                    disabled={loading}
                                >
                                    {loading ? 'Sending Request...' : 'Send Request'}
                                </Button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Request Sent!</h3>
                        <p className="text-gray-500 mb-6">
                            Your meeting request has been sent to <strong>{standName}</strong>. You will be notified when they respond.
                        </p>
                        <Button onClick={onClose} variant="outline" className="w-full">
                            Close
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
