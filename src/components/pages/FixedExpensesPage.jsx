import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { CheckCircle, Circle, Calendar, Search, Filter, ChevronLeft, ChevronRight, History, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { PaymentModal } from '../organisms/PaymentModal';

export function FixedExpensesPage({ transactions, onUpdateStatus, onEdit, onDelete }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'paid', 'pending'
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPayment, setSelectedPayment] = useState(null); // Modal control
    const itemsPerPage = 5;

    // Helper: Normalize Status
    const isPaid = (status) => ['Pago', 'Liberado'].includes(status);

    // Helper: Format Currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    // Helper: Parse Date (DD/MM/YYYY)
    const parseDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    };

    // Helper: Calculate next occurrence for recurring expenses
    const calculateNextOccurrence = (expense) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expenseDate = parseDate(expense.date);
        
        // If expense is in the future, that's the next occurrence
        if (expenseDate >= today) return expenseDate;

        // If in the past, calculate next based on recurrence
        let nextDate = new Date(expenseDate);
        while (nextDate < today) {
            switch (expense.recurrence) {
                case 'daily':
                    nextDate.setDate(nextDate.getDate() + 1);
                    break;
                case 'weekly':
                    nextDate.setDate(nextDate.getDate() + 7);
                    break;
                case 'monthly':
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    break;
                case 'quarterly':
                    nextDate.setMonth(nextDate.getMonth() + 3);
                    break;
                case 'semiannual':
                    nextDate.setMonth(nextDate.getMonth() + 6);
                    break;
                case 'annual':
                    nextDate.setFullYear(nextDate.getFullYear() + 1);
                    break;
                case 'biennial':
                    nextDate.setFullYear(nextDate.getFullYear() + 2);
                    break;
                default: // Default to monthly if unknown
                    nextDate.setMonth(nextDate.getMonth() + 1);
            }
        }
        return nextDate;
    };

    const handleTogglePaid = (transaction) => {
        const currentlyPaid = isPaid(transaction.status);
        if (currentlyPaid) {
            // If already paid, just toggle back to pending (simple toggle)
            onUpdateStatus(transaction.id, 'Aguardando');
        } else {
            // If pending, open modal to confirm details
            setSelectedPayment(transaction);
        }
    };

    const confirmPayment = (id, status, date, interest) => {
        onUpdateStatus(id, status, date, interest);
        setSelectedPayment(null);
    };

    // 1. Base Fixed Expenses
    const baseFixedExpenses = transactions.filter(t => t.type === 'expense' && t.expenseType === 'fixed');

    // 2. Generate Projections (Virtual Expenses) based on ALL fixed expenses (before filtering)
    const recurringGroups = {};
    baseFixedExpenses.forEach(t => {
        if (t.recurrence) {
            const key = `${t.description}-${t.amount}-${t.recurrence}`;
            // Track the latest occurrence
            if (!recurringGroups[key] || parseDate(recurringGroups[key].date) < parseDate(t.date)) {
                recurringGroups[key] = t;
            }
        }
    });

    const virtualExpenses = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    Object.values(recurringGroups).forEach(lastExpense => {
        const lastDate = parseDate(lastExpense.date);
        
        // If the last expense is in the future/today and unpaid, it's already in the list.
        // We don't need a virtual copy of it.
        if (lastDate >= today && !isPaid(lastExpense.status)) return;

        // Calculate next due date
        const nextDate = calculateNextOccurrence(lastExpense);
        
        // Create virtual expense
        const virtualExpense = {
            ...lastExpense,
            id: `virtual-${lastExpense.id}-${nextDate.getTime()}`, // unique temp id
            date: nextDate.toLocaleDateString('pt-BR'),
            status: 'Aguardando', // Always pending for future
            isVirtual: true // Flag to identify it's a projection
        };
        
        virtualExpenses.push(virtualExpense);
    });

    // 3. Combine Real + Virtual
    let allCandidates = [...baseFixedExpenses, ...virtualExpenses];

    // 4. Apply Filters (Search & Status)
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        allCandidates = allCandidates.filter(t => t.description.toLowerCase().includes(lowerTerm));
    }

    if (filterStatus !== 'all') {
        if (filterStatus === 'paid') {
            allCandidates = allCandidates.filter(t => isPaid(t.status));
        } else if (filterStatus === 'pending') {
            allCandidates = allCandidates.filter(t => !isPaid(t.status));
        }
    }

    // 5. Split into Upcoming vs Past
    const upcomingExpenses = [];
    const pastExpenses = [];

    allCandidates.forEach(t => {
        const tDate = parseDate(t.date);
        const paid = isPaid(t.status);

        // Logic for splitting:
        // Upcoming: Future dates (>= today) AND Not Paid
        // Past: Past dates (< today) OR Paid items
        
        if (tDate < today || paid) {
            pastExpenses.push(t);
        } else {
            upcomingExpenses.push(t);
        }
    });

    // 5. Sort Upcoming (Ascending Date: Today -> Future)
    upcomingExpenses.sort((a, b) => parseDate(a.date) - parseDate(b.date));

    // 6. Sort Past (Unpaid First, Then Descending Date: Yesterday -> Way back)
    pastExpenses.sort((a, b) => {
        const paidA = isPaid(a.status);
        const paidB = isPaid(b.status);

        // If payment status differs, Pending comes first (Pending is false, Paid is true)
        if (paidA !== paidB) {
            return paidA ? 1 : -1; 
        }

        // If status is same, sort by Date Descending
        return parseDate(b.date) - parseDate(a.date);
    });

    // 7. Pagination for Past Expenses
    const totalPages = Math.ceil(pastExpenses.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedPastExpenses = pastExpenses.slice(startIndex, startIndex + itemsPerPage);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
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

    // Render Transaction Item Helper
    const TransactionItem = ({ expense }) => {
        const paid = isPaid(expense.status);
        // Check if overdue: not paid AND date < today
        const tDate = parseDate(expense.date);
        const isOverdue = !paid && tDate < today;
        const isVirtual = expense.isVirtual;

        return (
            <div
                className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all hover:bg-gray-50 group",
                    paid ? "bg-gray-50/50 border-gray-100" : "bg-white border-gray-200",
                    isOverdue && "border-red-100 bg-red-50/30",
                    isVirtual && "border-amber-100 bg-amber-50/20 border-dashed"
                )}
            >
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => !isVirtual && handleTogglePaid(expense)}
                        className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center transition-all",
                            isVirtual 
                                ? "bg-gray-100 text-gray-300 cursor-default"
                                : paid
                                    ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                                    : "bg-gray-100 text-gray-400 hover:bg-gray-200",
                            !paid && isOverdue && !isVirtual && "ring-2 ring-red-100"
                        )}
                        title={isVirtual ? "Previsão futura" : (paid ? "Marcar como pendente" : "Marcar como pago")}
                        disabled={isVirtual}
                    >
                        {paid ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    </button>
                    
                    <div className="flex flex-col">
                        <span className={cn(
                            "font-medium text-sm",
                            paid ? "text-gray-500 line-through" : "text-gray-900"
                        )}>
                            {expense.description} {isVirtual && <span className="text-amber-600 text-xs font-normal">(Previsão)</span>}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={cn(isOverdue && "text-red-600 font-medium")}>
                                {paid ? `Pago em: ${expense.date}` : `Vence em: ${expense.date}`}
                            </span>
                            <span>•</span>
                            <span>
                                {expense.recurrence 
                                    ? `Recorrência: ${RECURRENCE_MAP[expense.recurrence.toLowerCase()] || expense.recurrence}` 
                                    : 'Recorrente'}
                            </span>
                            {expense.interestRate && (
                                <>
                                    <span>•</span>
                                    <span className="text-red-500">Juros: {expense.interestRate}%</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <span className={cn(
                            "block font-semibold text-sm",
                            paid ? "text-gray-400 line-through" : "text-red-600"
                        )}>
                            {formatCurrency(expense.amount)}
                        </span>
                        <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-medium",
                            paid 
                                ? "bg-emerald-100 text-emerald-700" 
                                : isOverdue 
                                    ? "bg-red-100 text-red-700"
                                    : isVirtual 
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-amber-100 text-amber-700"
                        )}>
                            {paid ? 'Pago' : isOverdue ? 'Atrasada' : isVirtual ? 'Previsto' : 'Pendente'}
                        </span>
                    </div>

                    {!isVirtual && (onEdit || onDelete) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {onEdit && (
                                <button 
                                    onClick={() => onEdit(expense)}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                                    title="Editar"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                            )}
                            {onDelete && (
                                <button 
                                    onClick={() => onDelete(expense.id)}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <PaymentModal 
                transaction={selectedPayment} 
                onClose={() => setSelectedPayment(null)} 
                onConfirm={confirmPayment}
            />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Despesas Fixas</h1>
                    <p className="text-muted-foreground text-sm">Gerencie suas contas recorrentes, pagamentos pendentes e histórico.</p>
                </div>
                
                {/* Search and Filter Bar */}
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar despesa..." 
                            className="pl-9 h-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="w-36">
                        <Select 
                            value={filterStatus} 
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="h-10"
                        >
                            <option value="all">Todos</option>
                            <option value="pending">Pendentes</option>
                            <option value="paid">Pagas</option>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Section 1: Upcoming Expenses */}
            <Card className="border-l-4 border-l-amber-400">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                        <Calendar className="h-5 w-5" />
                        Despesas por Vir
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {upcomingExpenses.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            Nenhuma despesa para os próximos dias.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {upcomingExpenses.map(expense => (
                                <TransactionItem key={expense.id} expense={expense} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Section 2: Past Expenses (History) */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-gray-700">
                        <History className="h-5 w-5" />
                        Despesas Anteriores
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {paginatedPastExpenses.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            Nenhuma despesa anterior encontrada.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                {paginatedPastExpenses.map(expense => (
                                    <TransactionItem key={expense.id} expense={expense} />
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                    <div className="text-xs text-muted-foreground">
                                        Página {currentPage} de {totalPages}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => goToPage(currentPage - 1)}
                                            disabled={currentPage === 1}
                                            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft className="h-4 w-4 text-gray-600" />
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                <button
                                                    key={page}
                                                    onClick={() => goToPage(page)}
                                                    className={cn(
                                                        "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
                                                        currentPage === page
                                                            ? "bg-[#7E1A8B] text-white"
                                                            : "text-gray-600 hover:bg-gray-100"
                                                    )}
                                                >
                                                    {page}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => goToPage(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRight className="h-4 w-4 text-gray-600" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
