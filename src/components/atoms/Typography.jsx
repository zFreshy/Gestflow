import React from 'react';
import { cn } from '../../lib/utils';

export function Typography({ variant = 'p', className, children, ...props }) {
    const components = {
        h1: 'h1',
        h2: 'h2',
        h3: 'h3',
        h4: 'h4',
        p: 'p',
        blockquote: 'blockquote',
        small: 'small',
        muted: 'p',
    };

    const Component = components[variant] || 'p';

    const variants = {
        h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
        h2: 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0',
        h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
        h4: 'scroll-m-20 text-xl font-semibold tracking-tight',
        p: 'leading-7 [&:not(:first-child)]:mt-6',
        blockquote: 'mt-6 border-l-2 pl-6 italic text-muted-foreground',
        small: 'text-sm font-medium leading-none',
        muted: 'text-sm text-muted-foreground',
    };

    return (
        <Component className={cn(variants[variant], className)} {...props}>
            {children}
        </Component>
    );
}
