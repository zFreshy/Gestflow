import React from 'react';
import { cn } from '../../lib/utils';

const accentColors = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    red: 'bg-rose-50 text-rose-600 ring-rose-100',
    yellow: 'bg-amber-50 text-amber-600 ring-amber-100',
    purple: 'bg-purple-50 text-purple-600 ring-purple-100',
    orange: 'bg-orange-50 text-orange-600 ring-orange-100',
};

const bgGradients = {
    blue: 'hover:bg-gradient-to-br hover:from-white hover:to-blue-50/50',
    green: 'hover:bg-gradient-to-br hover:from-white hover:to-emerald-50/50',
    red: 'hover:bg-gradient-to-br hover:from-white hover:to-rose-50/50',
    yellow: 'hover:bg-gradient-to-br hover:from-white hover:to-amber-50/50',
    purple: 'hover:bg-gradient-to-br hover:from-white hover:to-purple-50/50',
    orange: 'hover:bg-gradient-to-br hover:from-white hover:to-orange-50/50',
};

export function StatCard({ title, value, icon: Icon, description, accent = 'blue', extra, children, className }) {
    return (
        <div className={cn(
            "bg-white rounded-3xl border border-gray-100/80 p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(6,81,237,0.1)] hover:-translate-y-1 flex flex-col h-full relative overflow-hidden group",
            bgGradients[accent],
            className
        )}>
            {/* Subtle top border accent */}
            <div className={cn("absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity", accentColors[accent].split(' ')[0])} />

            {/* Header row */}
            <div className="flex items-start justify-between mb-4 relative z-10">
                <p className="text-[15px] font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">{title}</p>
                {Icon && (
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl ring-1 transition-transform group-hover:scale-110 group-hover:rotate-3 shrink-0", accentColors[accent])}>
                        <Icon className="h-5 w-5" />
                    </div>
                )}
            </div>

            {/* Custom children (for multi-stat) */}
            <div className="flex-1 flex flex-col justify-center relative z-10">
                {children ? (
                    children
                ) : (
                    <>
                        <p className="text-[32px] font-extrabold text-gray-900 tracking-tight leading-none mb-1">{value}</p>
                        {description && (
                            <p className="text-sm text-gray-500 font-medium">{description}</p>
                        )}
                    </>
                )}
            </div>

            {/* Extra info at bottom */}
            {extra && <div className="mt-4 relative z-10">{extra}</div>}
        </div>
    );
}
