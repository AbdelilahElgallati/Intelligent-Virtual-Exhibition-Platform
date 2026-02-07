import React from 'react';
import { Users, Briefcase, MessageSquare, Handshake, ChevronRight, UserPlus } from 'lucide-react';

export const NetworkingSidebar: React.FC = () => {
    const suggestedConnections = [
        { name: 'Sarah Wilson', role: 'CTO @ TechFlow', bio: 'Looking for AI partnerships' },
        { name: 'Marcus Chen', role: 'VP Engineering @ ScaleUp', bio: 'Interested in RAG solutions' },
        { name: 'Elena Rodriguez', role: 'Digital Architect', bio: 'Platform UX specialist' },
    ];

    return (
        <div className="w-80 h-full bg-white border-l border-gray-100 flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Handshake size={20} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Networking</h2>
            </div>

            <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Suggestions</h3>
                    <button className="text-[10px] text-indigo-600 font-bold hover:underline">See All</button>
                </div>

                <div className="space-y-4">
                    {suggestedConnections.map((user, i) => (
                        <div key={i} className="flex gap-3 items-start p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 group">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-indigo-600 font-bold">
                                {user.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-gray-900 truncate">{user.name}</h4>
                                <p className="text-[11px] text-indigo-600 font-medium mb-1">{user.role}</p>
                                <p className="text-[10px] text-gray-400 line-clamp-1">{user.bio}</p>
                            </div>
                            <button className="p-1.5 text-gray-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100">
                                <UserPlus size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mb-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Your Network</h3>
                <div className="grid grid-cols-1 gap-3">
                    <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100 relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                            <Users size={80} />
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1">Total Connections</p>
                            <div className="text-2xl font-black">248</div>
                            <button className="flex items-center gap-1 text-[10px] font-bold mt-2 opacity-90 hover:opacity-100">
                                View My List <ChevronRight size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <div className="mt-auto bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
                <div className="p-2 bg-white text-gray-400 rounded-xl">
                    <Briefcase size={18} />
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-900">Open to Work</p>
                    <p className="text-[10px] text-gray-500">Switch status for recruiters</p>
                </div>
                <div className="ml-auto w-8 h-4 bg-indigo-600 rounded-full relative">
                    <div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full"></div>
                </div>
            </div>
        </div>
    );
};
