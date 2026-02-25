import React from 'react';
import { Typography } from '../atoms/Typography';
import { ArrowDownRight, ArrowUpRight, Copy, CreditCard, Banknote } from 'lucide-react';
import { cn } from '../../lib/utils';

export function TransactionItem({ description, amount, date, type, paymentMethod }) {
    const isIncome = type === 'income';

    const MethodIcon = () => {
        switch (paymentMethod) {
            case 'pix':
                return <Copy className="h-4 w-4 text-muted-foreground" />;
            case 'cartao':
                return <CreditCard className="h-4 w-4 text-muted-foreground" />;
            case 'dinheiro':
            default:
                return <Banknote className="h-4 w-4 text-muted-foreground" />;
        }
    };

    return (
        <div className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded-lg group cursor-default">
            <div className="flex items-center space-x-4">
                <div
                    className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        isIncome ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    )}
                >
                    {isIncome ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                </div>
                <div>
                    <Typography variant="p" className="font-medium leading-none m-0">
                        {description}
                    </Typography>
                    <div className="flex items-center space-x-2 mt-1">
                        <Typography variant="muted" className="text-xs">
                            {date}
                        </Typography>
                        <span className="text-muted-foreground/50 text-xs">•</span>
                        <div className="flex items-center space-x-1" title={`Método: ${paymentMethod}`}>
                            <MethodIcon />
                            <Typography variant="muted" className="text-xs capitalize">
                                {paymentMethod}
                            </Typography>
                        </div>
                    </div>
                </div>
            </div>
            <div className="text-right">
                <Typography
                    variant="p"
                    className={cn("font-bold", isIncome ? "text-success" : "text-destructive")}
                >
                    {isIncome ? '+' : '-'} {amount}
                </Typography>
            </div>
        </div>
    );
}
