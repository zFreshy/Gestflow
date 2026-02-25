import React from 'react';
import { cn } from '../../lib/utils';

export function StatCard({ title, value, icon: Icon, description, accent = 'blue', extra, children, className }) {
    const accentStyles = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-emerald-50 text-emerald-600',
        red: 'bg-red-50 text-red-600',
        yellow: 'bg-amber-50 text-amber-600',
        purple: 'bg-violet-50 text-violet-600',
    };

    return (
        <div className={cn(
            "bg-card rounded-2xl border p-6 shadow-sm transition-all hover:shadow-md",
            className
        )}>
            {/* Header row */}
            <div className="flex items-start justify-between mb-4">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                {Icon && (
                    <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                        accentStyles[accent]
                    )}>
                        <Icon className="h-4 w-4" />
                    </div>
                )}
            </div>

            {/* Custom children (for multi-stat) */}
            {children ? (
                <div>{children}</div>
            ) : (
                <>
                    <p className="text-3xl font-bold tracking-tight mb-1">{value}</p>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </>
            )}

            {/* Extra info at bottom */}
            {extra && <div className="mt-3 pt-3 border-t">{extra}</div>}
        </div>
    );
}
