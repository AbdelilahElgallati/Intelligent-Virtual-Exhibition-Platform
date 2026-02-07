import React from 'react';
import { KPICard } from './KPICard';
import { MainChart } from './MainChart';
import { CategoryChart } from './CategoryChart';
import { useAnalytics } from '../../hooks/useAnalytics';
import { Users, MousePointer2, Star, Share2, LayoutGrid } from 'lucide-react';

interface StandDashboardProps {
    standId: string;
}

export const StandDashboard: React.FC<StandDashboardProps> = ({ standId }) => {
    const { data, isLoading, isError, error } = useAnalytics('stand', standId);

    if (isLoading) return <div className="p-8 animate-pulse text-gray-400">Loading metrics...</div>;
    if (isError) return <div className="p-8 text-rose-500">Error: {(error as Error).message}</div>;
    if (!data) return null;

    const icons = [
        <Users size={20} />,
        <MousePointer2 size={20} />,
        <Star size={20} />,
        <Share2 size={20} />
    ];

    const colors: ('indigo' | 'emerald' | 'rose' | 'amber')[] = ['indigo', 'emerald', 'rose', 'amber'];

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Stand Analytics</h1>
                    <p className="text-gray-500 text-sm">Real-time performance metrics for your virtual stand.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm">
                        Last 30 Days
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md active:scale-95">
                        Export Data
                    </button>
                </div>
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {data.kpis.map((kpi, i) => (
                    <KPICard
                        key={i}
                        label={kpi.label}
                        value={kpi.value}
                        trend={kpi.trend}
                        unit={kpi.unit}
                        icon={icons[i % icons.length]}
                        color={colors[i % colors.length]}
                    />
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <MainChart data={data.main_chart} title="Visitor Traffic over Time" dataKey="value" />
                </div>
                <div>
                    <CategoryChart data={data.distribution} title="Engagement by Resource" />
                </div>
            </div>

            {/* Additional Stats */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                        <LayoutGrid size={24} />
                    </div>
                    <h4 className="text-lg font-bold">Stand Heatmap</h4>
                    <p className="text-sm text-gray-500 mb-6 px-4">See where visitors click most on your interactive stand.</p>
                    <button className="text-indigo-600 font-bold text-xs uppercase tracking-widest hover:underline">View Heatmap</button>
                </div>
                {/* Add more widgets here */}
            </div>
        </div>
    );
};
