import React from 'react';
import { cn } from '../../lib/utils';

export function StatCard({ title, value, icon: Icon, description, accent = 'blue', extra, children, className }) {
    return (
        <div className={cn(
            "bg-white rounded-2xl border border-gray-100 p-6 shadow-sm transition-all hover:shadow-md flex flex-col h-full",
            className
        )}>
            {/* Header row */}
            <div className="flex items-start justify-between mb-2">
                <p className="text-[15px] font-medium text-gray-700">{title}</p>
                {Icon && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 shrink-0">
                        <Icon className="h-4 w-4" />
                    </div>
                )}
            </div>

            {/* Custom children (for multi-stat) */}
            <div className="flex-1 flex flex-col justify-center">
                {children ? (
                    children
                ) : (
                    <>
                        <p className="text-[32px] font-bold text-gray-900 tracking-tight leading-none mb-1">{value}</p>
                        {description && (
                            <p className="text-sm text-gray-500">{description}</p>
                        )}
                    </>
                )}
            </div>

            {/* Extra info at bottom */}
            {extra && <div>{extra}</div>}
        </div>
    );
}
