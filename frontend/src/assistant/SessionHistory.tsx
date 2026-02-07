import React from 'react';
import { History, MessageCircle, Plus, Search } from 'lucide-react';

interface Session {
    id: string;
    title: string;
    date: string;
}

interface SessionHistoryProps {
    sessions: Session[];
    currentSessionId?: string;
    onSelectSession: (id: string) => void;
    onNewChat: () => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
    sessions,
    currentSessionId,
    onSelectSession,
    onNewChat
}) => {
    return (
        <div className="w-80 border-r bg-gray-50 flex flex-col h-full shrink-0">
            <div className="p-4 border-b bg-white">
                <button
                    onClick={onNewChat}
                    className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 font-semibold hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                    <Plus size={18} />
                    <span>New Chat</span>
                </button>
            </div>

            <div className="p-4 border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 mt-2">
                <h4 className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Recent Chats</h4>
                {sessions.map((session) => (
                    <button
                        key={session.id}
                        onClick={() => onSelectSession(session.id)}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 group ${currentSessionId === session.id
                                ? 'bg-white shadow-sm ring-1 ring-indigo-500/10 text-indigo-700'
                                : 'hover:bg-gray-200/50 text-gray-600'
                            }`}
                    >
                        <div className={`p-2 rounded-lg shrink-0 ${currentSessionId === session.id ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-200 text-gray-400 group-hover:bg-gray-300'
                            }`}>
                            <MessageCircle size={16} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{session.title}</p>
                            <p className="text-[10px] opacity-60 mt-0.5">{session.date}</p>
                        </div>
                    </button>
                ))}
            </div>

            <div className="p-4 border-t bg-white mt-auto">
                <button className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors px-2">
                    <History size={16} />
                    Clear all history
                </button>
            </div>
        </div>
    );
};
