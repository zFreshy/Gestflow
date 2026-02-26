import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { CheckCircle, Circle, AlertCircle, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';

export function FixedExpensesPage({ transactions, onUpdateStatus }) {
    const fixedExpenses = transactions.filter(
        t => t.type === 'expense' && t.expenseType === 'fixed'
    ).sort((a, b) => {
        // Sort by date (ascending)
        const [d1, m1, y1] = a.date.split('/');
        const [d2, m2, y2] = b.date.split('/');
        return new Date(`${y1}-${m1}-${d1}`) - new Date(`${y2}-${m2}-${d2}`);
    });

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const handleTogglePaid = (transaction) => {
        const newStatus = transaction.status === 'Pago' ? 'Pendente' : 'Pago';
        onUpdateStatus(transaction.id, newStatus);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Despesas Fixas</h1>
                <p className="text-muted-foreground">Gerencie suas contas recorrentes e pagamentos pendentes.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-gray-500" />
                        Próximas Despesas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {fixedExpenses.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            Nenhuma despesa fixa cadastrada.
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {fixedExpenses.map((expense) => {
                                const isPaid = expense.status === 'Pago';
                                return (
                                    <div
                                        key={expense.id}
                                        className={cn(
                                            "flex items-center justify-between p-4 rounded-xl border transition-all hover:bg-gray-50",
                                            isPaid ? "bg-gray-50/50 border-gray-100" : "bg-white border-gray-200"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => handleTogglePaid(expense)}
                                                className={cn(
                                                    "h-6 w-6 rounded-full flex items-center justify-center transition-all",
                                                    isPaid
                                                        ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                                                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                                )}
                                            >
                                                {isPaid ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                            </button>
                                            
                                            <div className="flex flex-col">
                                                <span className={cn(
                                                    "font-medium text-sm",
                                                    isPaid ? "text-gray-500 line-through" : "text-gray-900"
                                                )}>
                                                    {expense.description}
                                                </span>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>Vence em: {expense.date}</span>
                                                    <span>•</span>
                                                    <span>{expense.recurrence ? `Recorrência: ${expense.recurrence}` : 'Recorrente'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <span className={cn(
                                                    "block font-semibold text-sm",
                                                    isPaid ? "text-gray-400 line-through" : "text-red-600"
                                                )}>
                                                    {formatCurrency(expense.amount)}
                                                </span>
                                                <span className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded-full font-medium",
                                                    isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                )}>
                                                    {isPaid ? 'Pago' : 'Pendente'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
