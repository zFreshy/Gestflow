import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { Avatar } from '../atoms/Avatar';
import { Search, ArrowUpDown, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { cn } from '../../lib/utils';

const METHOD_LABELS = {
    pix: 'Pix',
    cartao: 'Cartão de Crédito',
    debito: 'Cartão de Débito',
    dinheiro: 'Dinheiro',
    credito_loja: 'Crédito Loja (fiado)',
    vale_alimentacao: 'Vale Alimentação',
    vale_combustivel: 'Vale Combustível',
    diversos: 'Diversos'
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

export function TransactionList({ transactions, onEdit, onDelete, onBatchDelete, viewMode = 'month', onLoadMore, hasMore, isLoadingMore }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterMethod, setFilterMethod] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    // Batch selection states
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredTransactions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
        }
    };

    const toggleGroupSelection = (groupKey) => {
        const groupTransactions = groupedTransactions[groupKey];
        const groupIds = groupTransactions.map(t => t.id);
        const newSet = new Set(selectedIds);
        
        // Verifica se todos os itens deste grupo já estão selecionados
        const allSelected = groupIds.every(id => newSet.has(id));
        
        if (allSelected) {
            // Deselecionar todos do grupo
            groupIds.forEach(id => newSet.delete(id));
        } else {
            // Selecionar todos do grupo
            groupIds.forEach(id => newSet.add(id));
        }
        
        setSelectedIds(newSet);
    };

    const isGroupFullySelected = (groupKey) => {
        const groupTransactions = groupedTransactions[groupKey];
        if (!groupTransactions || groupTransactions.length === 0) return false;
        return groupTransactions.every(t => selectedIds.has(t.id));
    };

    const isGroupPartiallySelected = (groupKey) => {
        const groupTransactions = groupedTransactions[groupKey];
        if (!groupTransactions || groupTransactions.length === 0) return false;
        const selectedCount = groupTransactions.filter(t => selectedIds.has(t.id)).length;
        return selectedCount > 0 && selectedCount < groupTransactions.length;
    };

    const handleBatchDelete = () => {
        if (selectedIds.size === 0) return;
        
        if (window.confirm(`Tem certeza que deseja excluir ${selectedIds.size} transações selecionadas?`)) {
            if (onBatchDelete) {
                onBatchDelete(Array.from(selectedIds));
                setSelectedIds(new Set());
                setIsSelectionMode(false);
            }
        }
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesType = true;
        if (filterType === 'income') {
            matchesType = t.type === 'income';
        } else if (filterType === 'bakery_income') {
            matchesType = t.type === 'income' && t.isBakeryIncome === true;
        } else if (filterType === 'expense') {
            matchesType = t.type === 'expense';
        }
        
        const matchesMethod = filterMethod === 'all' || t.paymentMethod === filterMethod;
        return matchesSearch && matchesType && matchesMethod;
    });

    const sorted = [...filteredTransactions].sort((a, b) => b.timestamp - a.timestamp);

    // Grouping Logic
    const groupedTransactions = sorted.reduce((groups, transaction) => {
        if (viewMode === 'year') {
            // Group by Month (0-11)
            const [day, month, year] = transaction.date.split('/');
            const monthIndex = parseInt(month) - 1;
            if (!groups[monthIndex]) {
                groups[monthIndex] = [];
            }
            groups[monthIndex].push(transaction);
        } else {
            // Group by Date
            const date = transaction.date;
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(transaction);
        }
        return groups;
    }, {});

    const sortedGroupKeys = Object.keys(groupedTransactions).sort((a, b) => {
        if (viewMode === 'year') {
            return parseInt(a) - parseInt(b);
        } else {
            // Sort dates descending
            const [dayA, monthA, yearA] = a.split('/');
            const [dayB, monthB, yearB] = b.split('/');
            return new Date(yearB, monthB - 1, dayB) - new Date(yearA, monthA - 1, dayA);
        }
    });

    const getGroupLabel = (key) => {
        if (viewMode === 'year') {
            const MONTHS = [
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
            ];
            return MONTHS[parseInt(key)];
        } else {
            return getDayLabel(key);
        }
    };

    const getDayLabel = (dateStr) => {
        if (!dateStr) return '';
        const [day, month, year] = dateStr.split('/');
        const date = new Date(year, month - 1, day);

        const today = new Date();
        if (date.getDate() === today.getDate() && 
            date.getMonth() === today.getMonth() && 
            date.getFullYear() === today.getFullYear()) {
            return 'Hoje';
        }

        return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const getDayTotal = (transactions) => {
        return transactions.reduce((acc, t) => {
            return acc + (t.type === 'income' ? t.amount : -t.amount);
        }, 0);
    };

    return (
        <div className="bg-card rounded-2xl border shadow-sm">
            {/* Header */}
            <div className="flex flex-col gap-4 px-6 py-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold">Transações</h3>
                        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-md">
                            {filteredTransactions.length}
                        </span>
                        
                        {/* Batch Delete Actions */}
                        {isSelectionMode ? (
                            <div className="flex items-center gap-2 ml-2 animate-in fade-in slide-in-from-left-4">
                                <button
                                    onClick={toggleSelectAll}
                                    className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                                >
                                    {selectedIds.size === filteredTransactions.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                </button>
                                <span className="text-sm font-medium text-gray-400">|</span>
                                <span className="text-sm font-medium text-purple-600">
                                    {selectedIds.size} selecionados
                                </span>
                                <button
                                    onClick={handleBatchDelete}
                                    disabled={selectedIds.size === 0}
                                    className="ml-2 flex items-center gap-1 text-sm bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Excluir Selecionados
                                </button>
                                <button
                                    onClick={() => {
                                        setIsSelectionMode(false);
                                        setSelectedIds(new Set());
                                    }}
                                    className="ml-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5"
                                >
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsSelectionMode(true)}
                                className="ml-2 text-sm text-gray-500 hover:text-purple-600 px-2 py-1 rounded hover:bg-purple-50 transition-colors hidden md:block"
                            >
                                Seleção Múltipla
                            </button>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Mobile Selection Button */}
                        {!isSelectionMode && (
                            <button
                                onClick={() => setIsSelectionMode(true)}
                                className="md:hidden flex items-center justify-center h-9 w-9 border rounded-lg text-gray-500 hover:bg-gray-50"
                                aria-label="Seleção Múltipla"
                            >
                                <ArrowUpDown className="h-4 w-4" />
                            </button>
                        )}
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
                            className={`flex items-center gap-1.5 text-sm font-medium border rounded-lg px-3 py-2 transition-colors hidden sm:flex ${filterType === 'bakery_income' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'text-gray-600 hover:bg-gray-50'}`}
                            onClick={() => setFilterType(filterType === 'bakery_income' ? 'all' : 'bakery_income')}
                        >
                            🍞 Só Padaria
                        </button>
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
                            <option value="income">Entradas (Todas)</option>
                            <option value="bakery_income">Entradas (Só Padaria)</option>
                            <option value="expense">Saídas (Despesas)</option>
                        </Select>
                        <Select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}>
                            <option value="all">Todos os Métodos</option>
                            <option value="pix">Pix</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="cartao">Cartão de Crédito</option>
                            <option value="debito">Cartão de Débito</option>
                            <option value="credito_loja">Crédito Loja (fiado)</option>
                            <option value="vale_alimentacao">Vale Alimentação</option>
                            <option value="vale_combustivel">Vale Combustível</option>
                            <option value="diversos">Diversos</option>
                        </Select>
                    </div>
                </div>
            </div>

            {/* List */}
            {sorted.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm border-t">
                    Nenhuma transação encontrada.
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {sortedGroupKeys.map(key => (
                        <div key={key} className="p-4 md:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {isSelectionMode && (
                                        <div 
                                            className="flex items-center justify-center cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleGroupSelection(key);
                                            }}
                                        >
                                            <input 
                                                type="checkbox"
                                                checked={isGroupFullySelected(key)}
                                                ref={input => {
                                                    if (input) {
                                                        input.indeterminate = isGroupPartiallySelected(key);
                                                    }
                                                }}
                                                onChange={() => {}} // Handled by div click
                                                className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                            />
                                        </div>
                                    )}
                                    <h4 className={cn(
                                        "text-sm font-semibold capitalize transition-all",
                                        isSelectionMode ? "ml-1" : "",
                                        getGroupLabel(key) === 'Hoje' ? "text-blue-600" : 
                                        viewMode === 'year' ? "text-lg text-[#7E1A8B]" : "text-gray-500"
                                    )}>
                                        {getGroupLabel(key)}
                                    </h4>
                                </div>
                                <span className={`text-sm font-bold ${getDayTotal(groupedTransactions[key]) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getDayTotal(groupedTransactions[key]))}
                                </span>
                            </div>
                            
                            <div className="space-y-3">
                                {groupedTransactions[key].map(t => {
                                    const isIncome = t.type === 'income';
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
                                        <div 
                                            key={t.id} 
                                            className={cn(
                                                "flex items-center justify-between p-3 rounded-xl border transition-all group",
                                                isSelectionMode ? "cursor-pointer" : "",
                                                selectedIds.has(t.id) ? "border-purple-300 bg-purple-50" : "border-gray-100 hover:bg-gray-50"
                                            )}
                                            onClick={() => isSelectionMode && toggleSelection(t.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                {isSelectionMode ? (
                                                    <div className="flex items-center justify-center h-10 w-10 shrink-0">
                                                        <input 
                                                            type="checkbox"
                                                            checked={selectedIds.has(t.id)}
                                                            onChange={() => {}} // Handled by parent div click
                                                            className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 pointer-events-none"
                                                        />
                                                    </div>
                                                ) : (
                                                    <Avatar name={t.description} size="sm" />
                                                )}
                                                <div>
                                                    <p className="font-semibold text-gray-900">
                                                        {t.description}
                                                        {t.installments && t.installments > 1 && (
                                                            <span className="ml-2 text-sm font-normal text-gray-500">
                                                                ({t.current_installment}/{t.installments})
                                                            </span>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                            {METHOD_LABELS[t.paymentMethod]}
                                                        </span>
                                                        {t.expenseType === 'fixed' && (
                                                            <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                                                Fixa
                                                            </span>
                                                        )}
                                                        {t.user_email && (
                                                            <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                                                Por: {t.user_email === 'ecarneirodemelo@gmail.com' ? 'Nal' : t.user_email === 'esthermenezes90@gmail.com' ? 'Esther' : t.user_email === 'matheusv090807@gmail.com' ? 'Matheus' : 'Sistema'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <span className={`block font-bold ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {isIncome ? '+' : '-'} {formattedAmount}
                                                    </span>
                                                    <span className={`text-xs font-medium ${statusColor}`}>
                                                        {statusLabel}
                                                    </span>
                                                </div>

                                                {(onEdit || onDelete) && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {onEdit && (
                                                            <button 
                                                                onClick={() => onEdit(t)}
                                                                className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        {onDelete && (
                                                            <button 
                                                                onClick={() => onDelete(t.id)}
                                                                className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    
                    {hasMore && (
                        <div className="p-6 flex justify-center border-t border-gray-100">
                            <button
                                onClick={onLoadMore}
                                disabled={isLoadingMore}
                                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isLoadingMore ? (
                                    <>
                                        <div className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                                        Carregando...
                                    </>
                                ) : (
                                    'Carregar Mais'
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
