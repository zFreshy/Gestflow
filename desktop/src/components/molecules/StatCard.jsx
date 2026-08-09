import React from 'react';
import { cn } from '../../lib/utils';

const TONES = {
    brand:   { bg: 'bg-[#7E1A8B]/10', icon: 'text-[#7E1A8B]' },
    success: { bg: 'bg-emerald-50',   icon: 'text-emerald-600' },
    danger:  { bg: 'bg-red-50',       icon: 'text-red-600' },
    warning: { bg: 'bg-amber-50',     icon: 'text-amber-600' },
    info:    { bg: 'bg-blue-50',      icon: 'text-blue-600' },
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', className }) {
    const t = TONES[tone] ?? TONES.brand;

    return (
        <div className={cn(
            "bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4",
            className
        )}>
            {Icon && (
                <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", t.bg)}>
                    <Icon className={cn("h-5 w-5", t.icon)} />
                </div>
            )}
            <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1 truncate">{value}</p>
                {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
            </div>
        </div>
    );
}
