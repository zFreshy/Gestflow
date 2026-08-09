import React from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = {
    success: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    warning: 'bg-amber-50 text-amber-600 border-amber-200',
    destructive: 'bg-red-50 text-red-600 border-red-200',
    info: 'bg-blue-50 text-blue-600 border-blue-200',
    brand: 'bg-[#7E1A8B]/10 text-[#7E1A8B] border-[#7E1A8B]/20',
    default: 'bg-gray-50 text-gray-600 border-gray-200',
};

export function Badge({ children, variant = 'default', className }) {
    return (
        <span
            className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                badgeVariants[variant] || badgeVariants.default,
                className
            )}
        >
            {children}
        </span>
    );
}
