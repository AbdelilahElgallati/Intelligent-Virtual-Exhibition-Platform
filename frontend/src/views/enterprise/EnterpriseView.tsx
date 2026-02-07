import React, { useState } from 'react';
import { LayoutDashboard, Users, FileBox, MessageSquare, Settings, LogOut, TrendingUp, BarChart3, Package, Bell } from 'lucide-react';
import { LeadCRM } from '../../components/leads/LeadCRM';
import { StandDashboard } from '../../components/analytics/StandDashboard';

export const EnterpriseView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'resources' | 'chat'>('dashboard');

    return (
        <div className="flex h-screen bg-[#F8FAFC]">
            {/* Sidebar Navigation */}
            <aside className="w-80 h-full bg-white border-r border-gray-100 flex flex-col p-8">
                <div className="flex items-center gap-3 mb-12">
                    <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white">
                        <LayoutDashboard size={22} fill="white" />
                    </div>
                    <span className="text-xl font-black text-gray-900 tracking-tighter uppercase">STATION<span className="text-indigo-600">.</span></span>
                </div>

                <nav className="flex-1 space-y-2">
                    {[
                        { id: 'dashboard', icon: BarChart3, label: 'Analytics' },
                        { id: 'leads', icon: Users, label: 'Lead CRM' },
                        { id: 'resources', icon: FileBox, label: 'Media Library' },
                        { id: 'chat', icon: MessageSquare, label: 'Exhibitor Chat' },
                    ].map((item: any) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === item.id
                                    ? 'bg-gray-900 text-white shadow-xl shadow-gray-200'
                                    : 'text-gray-400 hover:bg-gray-50'
                                }`}
                        >
                            <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="mt-auto pt-8 border-t border-gray-50 space-y-2">
                    <button className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all">
                        <Settings size={20} /> Settings
                    </button>
                    <button className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold text-rose-500 hover:bg-rose-50 transition-all">
                        <LogOut size={20} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-12 overflow-y-auto">
                <header className="flex items-center justify-between mb-12">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight capitalize">
                            {activeTab === 'dashboard' ? 'Exhibition Performance' : activeTab.replace(/([A-Z])/g, ' $1')}
                        </h1>
                        <p className="text-gray-400 font-medium mt-1">Monitoring real-time interactions for Stand #001</p>
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="w-12 h-12 rounded-2xl border border-gray-100 bg-white flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm">
                            <Bell size={20} />
                        </button>
                        <div className="flex items-center gap-4 pl-6 border-l border-gray-100">
                            <div className="text-right">
                                <div className="text-sm font-black text-gray-900">Alex Thompson</div>
                                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Enterprise Lead</div>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-600">A</div>
                        </div>
                    </div>
                </header>

                {/* Dynamic Inner Dashboards */}
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full">
                    {activeTab === 'dashboard' && <StandDashboard standId="stand_001" />}
                    {activeTab === 'leads' && <LeadCRM standId="stand_001" />}
                    {activeTab === 'resources' && (
                        <div className="bg-white rounded-[2.5rem] p-12 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                            <Package size={64} className="text-gray-100 mb-6" />
                            <h2 className="text-2xl font-black text-gray-900 mb-2">Media Library coming soon</h2>
                            <p className="text-gray-400 font-medium max-w-sm">We are finalizing the bulk upload and catalog management system.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
