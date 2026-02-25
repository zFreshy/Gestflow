import React from 'react';
import { cn } from '../../lib/utils';
import { Typography } from '../atoms/Typography';

export function FormField({ label, error, className, children }) {
    return (
        <div className={cn('flex flex-col space-y-2', className)}>
            <Typography variant="small" className={cn(error && "text-destructive")}>
                {label}
            </Typography>
            {children}
            {error && (
                <Typography variant="muted" className="text-destructive text-xs">
                    {error}
                </Typography>
            )}
        </div>
    );
}
