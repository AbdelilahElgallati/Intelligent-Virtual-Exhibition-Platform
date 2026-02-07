import React, { useState } from 'react';
import { Search, Map, Layout, Zap, Calendar, Heart, MessageCircle } from 'lucide-react';
import { AssistantChat } from '../../assistant/AssistantChat';
import { MeetingBookingList } from '../../components/meetings/MeetingBookingList';
import { ResourceCatalog } from '../../components/resources/ResourceCatalog';

export const VisitorView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'hall' | 'stand' | 'appointments'>('hall');

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
            {/* Dynamic Navigation */}
            <nav className="h-20 bg-white border-b border-gray-100 px-10 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-10">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                            <Zap size={24} fill="white" />
                        </div>
                        <span className="text-xl font-black text-gray-900 tracking-tighter">IVEP<span className="text-indigo-600">.</span></span>
                    </div>

                    <div className="flex items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2 w-96 group focus-within:border-indigo-200 transition-all">
                        <Search size={18} className="text-gray-400 group-focus-within:text-indigo-500" />
                        <input
                            type="text"
                            placeholder="Search stands, experts, or workshops..."
                            className="bg-transparent border-none outline-none ml-2 w-full text-sm font-medium text-gray-600"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <button
                        onClick={() => setActiveTab('hall')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'hall' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Map size={18} /> Exhibition Hall
                    </button>
                    <button
                        onClick={() => setActiveTab('appointments')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'appointments' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Calendar size={18} /> My Appointments
                    </button>
                    <div className="w-10 h-10 rounded-2xl bg-gray-100 border-2 border-white shadow-sm overflow-hidden">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Avatar" />
                    </div>
                </div>
            </nav>

            <main className="flex-1 p-10 max-w-7xl mx-auto w-full grid grid-cols-12 gap-8">
                <div className="col-span-8 space-y-8">
                    {activeTab === 'hall' && (
                        <>
                            <section className="bg-indigo-600 rounded-[2.5rem] p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                                <div className="relative z-10">
                                    <h1 className="text-4xl font-black mb-4">Welcome to the<br />Digital Future Expo.</h1>
                                    <p className="text-indigo-100 font-medium max-w-md mb-8">Interact with over 50+ innovative stands and join live webinars with global industry leaders.</p>
                                    <button className="px-8 py-3 bg-white text-indigo-600 rounded-2xl font-black text-sm hover:scale-105 transition-transform">Get Started</button>
                                </div>
                                <div className="absolute right-0 top-0 opacity-10 scale-150 rotate-12">
                                    <Zap size={300} />
                                </div>
                            </section>

                            <section>
                                <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                                    Featured Stands <span className="bg-rose-500 w-2 h-2 rounded-full animate-pulse"></span>
                                </h2>
                                <div className="grid grid-cols-2 gap-6">
                                    {[1, 2].map(i => (
                                        <div key={i} className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                                            <div className="w-16 h-16 rounded-2xl bg-gray-50 mb-6 group-hover:scale-110 transition-transform flex items-center justify-center text-3xl">🚀</div>
                                            <h3 className="text-xl font-bold text-gray-900 mb-2">Stand #{i} Solutions</h3>
                                            <p className="text-sm text-gray-500 mb-6 line-clamp-2">Leading provider of AI-driven analytics and cloud infrastructure services.</p>
                                            <button
                                                onClick={() => setActiveTab('stand')}
                                                className="w-full py-3 bg-gray-50 text-gray-900 rounded-xl font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-all capitalize"
                                            >
                                                Visit stand
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </>
                    )}

                    {activeTab === 'stand' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <section className="bg-white rounded-[2.5rem] p-12 border border-gray-100 shadow-sm flex items-center gap-10">
                                <div className="w-32 h-32 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-5xl">🌌</div>
                                <div className="flex-1">
                                    <h2 className="text-3xl font-black text-gray-900 mb-2">SpaceTech Industry</h2>
                                    <p className="text-gray-500 font-medium">Next-generation satellite systems and orbital mechanics.</p>
                                    <div className="flex items-center gap-4 mt-6">
                                        <button className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100">Live Demo</button>
                                        <button className="px-6 py-2 border border-gray-100 hover:bg-gray-50 rounded-xl text-xs font-bold transition-colors">Website</button>
                                    </div>
                                </div>
                            </section>
                            <ResourceCatalog standId="stand_001" />
                        </div>
                    )}

                    {activeTab === 'appointments' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <MeetingBookingList />
                        </div>
                    )}
                </div>

                <aside className="col-span-4 space-y-8">
                    <div className="bg-white rounded-[2rem] p-8 border border-indigo-100 shadow-sm shadow-indigo-50/20">
                        <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                            <Heart size={20} className="text-rose-500" /> Recommendations
                        </h3>
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-4 p-4 rounded-2xl hover:bg-indigo-50/50 transition-colors border border-transparent hover:border-indigo-100 cursor-pointer group">
                                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0"></div>
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-900 group-hover:text-indigo-600">Product Concept #{i}</h4>
                                        <p className="text-[10px] text-gray-400 mt-1">Highly relevant to your profile</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-gray-900 to-indigo-950 rounded-[2rem] p-8 text-white shadow-2xl shadow-indigo-200">
                        <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                            <MessageCircle size={20} className="text-indigo-400" /> Need Help?
                        </h3>
                        <p className="text-xs text-indigo-200 font-medium leading-relaxed mb-6">Our AI Assistant can guide you through the exhibition hall and answer questions about stands.</p>
                        <button className="w-full py-3 bg-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-500 transition-colors">Start Assistant Chat</button>
                    </div>
                </aside>
            </main>

            {/* Floating Assistant Chat Widget Integration */}
            <AssistantChat />
        </div>
    );
};
