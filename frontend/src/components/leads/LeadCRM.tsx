import React from 'react';
import { UserCheck, TrendingUp, Mail, Tag, Download, Filter, Search, MoreHorizontal, User } from 'lucide-react';
import { useLeads } from '../../hooks/useLeads';

interface LeadCRMProps {
    standId: string;
}

export const LeadCRM: React.FC<LeadCRMProps> = ({ standId }) => {
    const { leads, isLoading, exportLeads, isExporting } = useLeads(standId);

    const getScoreColor = (score: number) => {
        if (score > 80) return 'text-emerald-500 bg-emerald-50';
        if (score > 40) return 'text-amber-500 bg-amber-50';
        return 'text-gray-400 bg-gray-50';
    };

    if (isLoading) return <div className="p-8 animate-pulse text-gray-400">Syncing lead data...</div>;

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden flex flex-col h-full">
            <header className="p-8 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-white to-gray-50/50">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        Lead CRM <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] rounded-full uppercase tracking-widest leading-none">Live</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Manage and export your stand's captured leads.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-2.5 text-gray-400 hover:text-indigo-600 transition-colors border border-gray-100 rounded-xl hover:bg-white shadow-sm">
                        <Filter size={18} />
                    </button>
                    <button
                        onClick={() => exportLeads()}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <Download size={18} /> {isExporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Visitor</th>
                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Score</th>
                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Interactions</th>
                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Last Activity</th>
                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tags</th>
                            <th className="px-8 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {leads.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-8 py-20 text-center">
                                    <UserCheck size={48} className="mx-auto text-gray-100 mb-4" />
                                    <p className="text-gray-400 font-medium">No leads captured yet. Keep engaging!</p>
                                </td>
                            </tr>
                        ) : leads.map((lead: any) => (
                            <tr key={lead.id} className="group hover:bg-gray-50/30 transition-colors">
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black">
                                            {lead.visitor_name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-gray-900 leading-tight">{lead.visitor_name}</div>
                                            <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                                                <Mail size={10} /> {lead.email}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${getScoreColor(lead.score)}`}>
                                        <TrendingUp size={12} /> {lead.score}
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className="text-sm font-bold text-gray-900">{lead.interactions_count}</span>
                                    <span className="text-[10px] text-gray-400 ml-1 font-medium italic">Events</span>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="text-xs font-bold text-gray-600">
                                        {new Date(lead.last_interaction).toLocaleDateString()}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-medium">
                                        {new Date(lead.last_interaction).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex flex-wrap gap-1.5">
                                        {lead.tags.length > 0 ? lead.tags.map((tag: string) => (
                                            <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[9px] font-bold uppercase tracking-wider">
                                                {tag}
                                            </span>
                                        )) : (
                                            <span className="text-[10px] text-gray-300 italic font-medium">No tags</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <button className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                        <MoreHorizontal size={20} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
