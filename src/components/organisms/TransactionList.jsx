import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { Avatar } from '../atoms/Avatar';
import { Search, ArrowUpDown, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';

const METHOD_LABELS = {
    pix: 'Pix',
    cartao: 'Cartão',
    dinheiro: 'Dinheiro',
};

const STATUS_MAP = {
    income: { label: 'Aprovado', color: 'text-emerald-500' },
    expense: { label: 'Processado', color: 'text-amber-500' },
};

const RECURRENCE_MAP = {
    'daily': 'Diária',
    'weekly': 'Semanal',
    'monthly': 'Mensal',
    'quarterly': 'Trimestral',
    'semiannual': 'Semestral',
    'annual': 'Anual',
    'biennial': 'Bienal'
};

export function TransactionList({ transactions, onEdit, onDelete }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterMethod, setFilterMethod] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || t.type === filterType;
        const matchesMethod = filterMethod === 'all' || t.paymentMethod === filterMethod;
        return matchesSearch && matchesType && matchesMethod;
    });

    const sorted = [...filteredTransactions].sort((a, b) => b.timestamp - a.timestamp);

    return (
        <div className="bg-card rounded-2xl border shadow-sm">
            {/* Header */}
            <div className="flex flex-col gap-4 px-6 py-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold">Transações Recentes</h3>
                        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-md">
                            {filteredTransactions.length}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="relative w-64 hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar..." 
                                className="pl-9 h-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            className={`flex items-center gap-1.5 text-sm font-medium border rounded-lg px-3 py-2 transition-colors ${isFilterOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                        >
                            Filtros <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Mobile Search & Filters */}
                <div className={`grid gap-4 transition-all duration-200 overflow-hidden ${isFilterOpen ? 'grid-rows-[1fr] opacity-100 pb-2' : 'grid-rows-[0fr] opacity-0 h-0 p-0'}`}>
                    <div className="grid md:grid-cols-3 gap-4 min-h-0">
                        <div className="md:hidden">
                            <Input 
                                placeholder="Buscar..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                            <option value="all">Todos os Tipos</option>
                            <option value="income">Entradas (Lucro)</option>
                            <option value="expense">Saídas (Despesas)</option>
                        </Select>
                        <Select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}>
                            <option value="all">Todos os Métodos</option>
                            <option value="pix">Pix</option>
                            <option value="cartao">Cartão</option>
                            <option value="dinheiro">Dinheiro</option>
                        </Select>
                    </div>
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
                                
                                // Determine status label and color
                                let statusLabel = STATUS_MAP[t.type].label;
                                let statusColor = STATUS_MAP[t.type].color;

                                if (t.type === 'expense' && t.expenseType === 'fixed') {
                                    if (t.status === 'Pago' || t.status === 'Liberado') {
                                        statusLabel = 'Pago';
                                        statusColor = 'text-emerald-500';
                                    } else {
                                        statusLabel = 'Pendente';
                                        statusColor = 'text-amber-500';
                                    }
                                }

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
                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                        <p className="text-xs text-emerald-500">
                                                            {METHOD_LABELS[t.paymentMethod]}
                                                        </p>
                                                        {t.expenseType === 'fixed' && (
                                                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                <span className="bg-gray-100 px-1.5 py-0.5 rounded">Fixa</span>
                                                                {t.recurrence && (
                                                                    <span>• {RECURRENCE_MAP[t.recurrence.toLowerCase()] || t.recurrence}</span>
                                                                )}
                                                            </p>
                                                        )}
                                                    </div>
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
                                            <div className="flex flex-col gap-1">
                                                <span className={`text-sm font-semibold ${statusColor}`}>
                                                    {statusLabel}
                                                </span>
                                                {t.status === 'Pago' && t.date && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        Pago em: {t.date}
                                                    </span>
                                                )}
                                            </div>
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
