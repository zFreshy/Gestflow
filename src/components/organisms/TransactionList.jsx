import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../atoms/Card';
import { TransactionItem } from '../molecules/TransactionItem';

export function TransactionList({ transactions }) {
    // Sort by newest first
    const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Histórico Recente</CardTitle>
                <CardDescription>
                    Suas últimas transações registradas.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto max-h-[400px] pr-2">
                {sorted.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                        Nenhuma transação encontrada.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sorted.map((t) => (
                            <TransactionItem
                                key={t.id}
                                description={t.description}
                                amount={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                                date={t.date}
                                type={t.type}
                                paymentMethod={t.paymentMethod}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
