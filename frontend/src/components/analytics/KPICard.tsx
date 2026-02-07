import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
    label: string;
    value: string | number;
    unit?: string;
    trend?: number;
    icon?: React.ReactNode;
    color?: 'indigo' | 'emerald' | 'amber' | 'rose';
}

export const KPICard: React.FC<KPICardProps> = ({
    label,
    value,
    unit,
    trend,
    icon,
    color = 'indigo'
}) => {
    const colorClasses = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        rose: 'bg-rose-50 text-rose-600',
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                    {icon}
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' :
                            trend < 0 ? 'bg-rose-50 text-rose-600' : 'bg-gray-50 text-gray-400'
                        }`}>
                        {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <div>
                <h4 className="text-gray-500 text-sm font-medium mb-1">{label}</h4>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900">{value}</span>
                    {unit && <span className="text-xs text-gray-400 font-medium">{unit}</span>}
                </div>
            </div>
        </div>
    );
};
