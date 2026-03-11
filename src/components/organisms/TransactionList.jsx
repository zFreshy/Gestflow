import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { Avatar } from '../atoms/Avatar';
import { Search, ArrowUpDown, ChevronDown, Pencil, Trash2 } from 'lucide-react';

const METHOD_LABELS = {
    pix: 'Pix',
    cartao: 'Cartão',
    dinheiro: 'Dinheiro',
};

const STATUS_MAP = {
    income: { label: 'Aprovado', color: 'text-emerald-500' },
    expense: { label: 'Processado', color: 'text-amber-500' },
};

export function TransactionList({ transactions, onEdit, onDelete }) {
    const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);

    return (
        <div className="bg-card rounded-2xl border shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold">Transações Recentes</h3>
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-md">
                        {transactions.length}
                    </span>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <Search className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 transition-colors">
                        Tipo <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 transition-colors">
                        Método <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button className="flex items-center gap-1.5 text-sm font-medium text-foreground border rounded-lg px-3 py-1.5 transition-colors hover:bg-muted">
                        Data <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Table */}
            {sorted.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm border-t">
                    Nenhuma transação encontrada neste mês.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-t">
                                <th className="px-6 py-3 text-left">
                                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors">
                                        <ArrowUpDown className="h-3 w-3" /> Descrição
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left">
                                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors">
                                        Tipo <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left">
                                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors">
                                        Data <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left">
                                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Método
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left">
                                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Valor
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left">
                                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Status <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </th>
                                {(onEdit || onDelete) && (
                                    <th className="px-6 py-3 text-right">
                                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Ações
                                        </div>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((t) => {
                                const isIncome = t.type === 'income';
                                const status = STATUS_MAP[t.type];
                                const formattedAmount = new Intl.NumberFormat('pt-BR', {
                                    style: 'currency', currency: 'BRL'
                                }).format(t.amount);

                                return (
                                    <tr
                                        key={t.id}
                                        className="border-t hover:bg-gray-50/80 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <Avatar name={t.description} size="sm" />
                                                <div>
                                                    <p className="text-sm font-medium leading-tight">{t.description}</p>
                                                    <p className="text-xs text-emerald-500 mt-0.5">
                                                        {METHOD_LABELS[t.paymentMethod]}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-muted-foreground">
                                                {isIncome ? '● Entrada' : '● Saída'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                                            {t.date}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="text-muted-foreground">
                                                {METHOD_LABELS[t.paymentMethod] || t.paymentMethod}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-sm font-semibold ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {isIncome ? '+' : '-'} {formattedAmount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-sm font-semibold ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        {(onEdit || onDelete) && (
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {onEdit && (
                                                        <button 
                                                            onClick={() => onEdit(t)}
                                                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button 
                                                            onClick={() => onDelete(t.id)}
                                                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
