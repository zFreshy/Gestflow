import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { CheckCircle, Circle, Calendar, Search, Filter, ChevronLeft, ChevronRight, History, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { PaymentModal } from '../organisms/PaymentModal';
import { MonthSelector } from '../molecules/MonthSelector';

export function FixedExpensesPage({ transactions, onUpdateStatus, onAddTransaction, onEdit, onDelete }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState('month'); // 'month' | 'year'
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'paid', 'pending'
    const [selectedPayment, setSelectedPayment] = useState(null); // Modal control

    // Helper: Normalize Status
    const isPaid = (status) => ['Pago', 'Liberado'].includes(status);

    // Helper: Format Currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    // Helper: Parse Date (DD/MM/YYYY or YYYY-MM-DD)
    const parseDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        
        // Handle ISO YYYY-MM-DD (e.g. from end_date)
        if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return new Date(year, month - 1, day);
        }

        // Handle DD/MM/YYYY
        if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            return new Date(year, month - 1, day);
        }

        return new Date(0);
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
            // If pending (real or virtual), open modal to confirm details
            setSelectedPayment(transaction);
        }
    };

    const confirmPayment = (id, status, date, interest, finalAmount) => {
        const amountToSave = finalAmount !== undefined ? finalAmount : selectedPayment.amount;

        if (selectedPayment?.isVirtual) {
            // Create new transaction for virtual expense
            // We use the ORIGINAL DUE DATE to keep the transaction in the correct month
            // and preserve the correct day for future recurrences!
            
            // Format date to DD/MM/YYYY if it's not already
            let formattedDate = selectedPayment.date; 
            if (formattedDate && formattedDate.includes('-')) {
                const [year, month, day] = formattedDate.split('-');
                formattedDate = `${day}/${month}/${year}`;
            }

            const newTransaction = {
                description: selectedPayment.description,
                amount: amountToSave + (interest || 0),
                type: 'expense',
                paymentMethod: selectedPayment.payment_method || selectedPayment.paymentMethod || 'pix',
                date: formattedDate, // This will be passed to App.jsx which expects DD/MM/YYYY
                clientName: selectedPayment.client_name,
                isBakeryIncome: false,
                recurrence: selectedPayment.recurrence,
                expenseType: 'fixed',
                status: 'Pago',
                active: true,
                interestRate: interest ? (interest / amountToSave) * 100 : 0
            };
            
            if (onAddTransaction) {
                onAddTransaction(newTransaction);
            }
        } else {
            // For real fixed expenses, we DO NOT change the date, we pass null for paymentDate
            // so App.jsx's handleUpdateStatus keeps the original due date.
            onUpdateStatus(id, status, null, interest, amountToSave);
        }
        setSelectedPayment(null);
    };

    // 1. Base Fixed Expenses
    const baseFixedExpenses = transactions.filter(t => t.type === 'expense' && t.expenseType === 'fixed');

    // 2. Generate Projections (Virtual Expenses) based on ALL fixed expenses (before filtering)
    // Refactored to look back 2 years to catch old but active expenses
    const recurringGroups = {};
    const lookbackDate = new Date();
    lookbackDate.setFullYear(lookbackDate.getFullYear() - 2); // 2 years ago

    baseFixedExpenses.forEach(t => {
        if (t.recurrence) {
            const key = `${t.description}-${t.amount}-${t.recurrence}`;
            
            // Only consider if it's the "best" candidate so far (latest date)
            // But we must respect the database: if we have multiple, we want the LATEST one.
            // Actually, we want to find the latest occurrence in DB to start projecting from.
            if (!recurringGroups[key] || parseDate(recurringGroups[key].date) < parseDate(t.date)) {
                recurringGroups[key] = t;
            }
        }
    });

    const virtualExpenses = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const addRecurrence = (date, recurrence) => {
        const newDate = new Date(date);
        switch (recurrence) {
            case 'daily': newDate.setDate(newDate.getDate() + 1); break;
            case 'weekly': newDate.setDate(newDate.getDate() + 7); break;
            case 'monthly': newDate.setMonth(newDate.getMonth() + 1); break;
            case 'quarterly': newDate.setMonth(newDate.getMonth() + 3); break;
            case 'semiannual': newDate.setMonth(newDate.getMonth() + 6); break;
            case 'annual': newDate.setFullYear(newDate.getFullYear() + 1); break;
            case 'biennial': newDate.setFullYear(newDate.getFullYear() + 2); break;
            default: newDate.setMonth(newDate.getMonth() + 1);
        }
        return newDate;
    };

    Object.values(recurringGroups).forEach(lastExpense => {
        let currentDate = parseDate(lastExpense.date);
        
        // If the last known expense is very old (older than lookback), we might want to skip it OR project forward.
        // If it's active, we MUST project forward to today.
        
        // Loop to generate ALL missing occurrences up to the first future one
        let safetyCounter = 0;
        const maxIterations = 500; // Increased limit for long gaps (e.g. 2 years of daily expenses)

        while (safetyCounter < maxIterations) {
            safetyCounter++;
            
            // Calculate next candidate date based on recurrence
            const nextDate = addRecurrence(currentDate, lastExpense.recurrence);
            
            // Check if this date is valid regarding end_date (if inactive)
             if (lastExpense.active === false) {
                if (!lastExpense.end_date) break; // Inactive with no end date -> stop generating
                
                let endDateObj;
                // Parse end_date safely (YYYY-MM-DD from DB)
                if (lastExpense.end_date.includes('/')) {
                    endDateObj = parseDate(lastExpense.end_date);
                } else {
                     const [y, m, d] = lastExpense.end_date.split('-');
                     endDateObj = new Date(y, m - 1, d);
                }
                
                // If the next occurrence is AFTER the end date, stop generating.
                if (nextDate > endDateObj) break;
            }

            // Update currentDate for next iteration
            currentDate = nextDate;

            // Check if this virtual expense already exists in DB (gap filling check)
            // We only add it if it DOESN'T match an existing transaction
            const exists = baseFixedExpenses.some(t => 
                t.description === lastExpense.description &&
                t.amount === lastExpense.amount &&
                parseDate(t.date).getTime() === nextDate.getTime()
            );

            if (!exists) {
                // Construct virtual expense
                const virtualExpense = {
                    ...lastExpense,
                    id: `virtual-${lastExpense.id}-${nextDate.getTime()}`, // Unique ID
                    date: nextDate.toLocaleDateString('pt-BR'), // DD/MM/YYYY
                    status: 'Aguardando', // Always pending
                    isVirtual: true // Flag
                };
                
                virtualExpenses.push(virtualExpense);
            }

            // If we have generated a future expense (>= today), we stop for this group.
            // This ensures we fill all past gaps + 1 future occurrence.
            if (nextDate >= today) break;
        }
    });

    // 3. Combine Real + Virtual
    let allCandidates = [...baseFixedExpenses, ...virtualExpenses];

    // Filter out cancelled transactions (active=false AND date > end_date)
    allCandidates = allCandidates.filter(t => {
        if (t.active === false && t.end_date) {
            const tDate = parseDate(t.date);
            const endDate = parseDate(t.end_date);
            // Hide if transaction date is strictly after end date
            // Using setHours to ensure we compare dates only
            tDate.setHours(0,0,0,0);
            endDate.setHours(0,0,0,0);
            
            if (tDate > endDate) return false;
        }
        return true;
    });

    // 4. Apply Filters (Search & Status)
    let filteredExpenses = allCandidates;

    // Filter by Month or Year
    filteredExpenses = filteredExpenses.filter(t => {
        const tDate = parseDate(t.date);
        const sameYear = tDate.getFullYear() === currentMonth.getFullYear();
        
        if (viewMode === 'year') {
            return sameYear;
        }
        
        return sameYear && tDate.getMonth() === currentMonth.getMonth();
    });

    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        filteredExpenses = filteredExpenses.filter(t => t.description.toLowerCase().includes(lowerTerm));
    }

    if (filterStatus !== 'all') {
        if (filterStatus === 'paid') {
            filteredExpenses = filteredExpenses.filter(t => isPaid(t.status));
        } else if (filterStatus === 'pending') {
            filteredExpenses = filteredExpenses.filter(t => !isPaid(t.status));
        }
    }

    // Sort by Date (Ascending)
    filteredExpenses.sort((a, b) => parseDate(a.date) - parseDate(b.date));

    // Grouping Logic
    const groupedExpenses = filteredExpenses.reduce((groups, expense) => {
        const date = parseDate(expense.date);
        
        if (viewMode === 'year') {
            // Group by Month (0-11)
            const monthKey = date.getMonth();
            if (!groups[monthKey]) {
                groups[monthKey] = [];
            }
            groups[monthKey].push(expense);
        } else {
            // Group by Date (DD/MM/YYYY)
            const dateKey = expense.date;
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(expense);
        }
        return groups;
    }, {});

    const sortedGroupKeys = Object.keys(groupedExpenses).sort((a, b) => {
        if (viewMode === 'year') {
            // Sort by Month Index (numeric)
            return parseInt(a) - parseInt(b);
        } else {
            // Sort by Date
            const dateA = parseDate(a);
            const dateB = parseDate(b);
            return dateA - dateB;
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
        const date = parseDate(dateStr);
        return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
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
        const isToday = !paid && tDate.getDate() === today.getDate() && tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear();
        const isVirtual = expense.isVirtual;

        return (
            <div
                className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all hover:bg-gray-50 group",
                    paid ? "bg-gray-50/50 border-gray-100" : "bg-white border-gray-200",
                    isOverdue && "border-red-100 bg-red-50/30",
                    isToday && "border-blue-200 bg-blue-50/30",
                    isVirtual && "border-amber-100 bg-amber-50/20 border-dashed"
                )}
            >
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => handleTogglePaid(expense)}
                        className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center transition-all",
                            paid
                                ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200",
                            !paid && isOverdue && "ring-2 ring-red-100",
                            !paid && isToday && "ring-2 ring-blue-100"
                        )}
                        title={paid ? "Marcar como pendente" : "Marcar como pago"}
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
                            <span className={cn(
                                isOverdue && "text-red-600 font-medium",
                                isToday && "text-blue-600 font-bold"
                            )}>
                                {paid ? `Pago em: ${expense.date}` : isToday ? 'Vence Hoje!' : `Vence em: ${expense.date}`}
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
                            {expense.active === false && expense.end_date && (
                                <>
                                    <span>•</span>
                                    <span className="text-orange-600 font-medium">Finalizada em: {expense.end_date}</span>
                                    <span>•</span>
                                    <span className="text-green-600 font-medium">Não virá mais cobrança</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <span className={cn(
                            "font-bold md:text-lg",
                            paid ? "text-gray-400 line-through" : "text-red-600"
                        )}>
                            {expense.amount === 0 ? 'A definir' : formatCurrency(expense.amount)}
                        </span>
                        <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-medium",
                            paid 
                                ? "bg-emerald-100 text-emerald-700" 
                                : isOverdue 
                                    ? "bg-red-100 text-red-700"
                                    : isToday
                                        ? "bg-blue-100 text-blue-700"
                                        : isVirtual 
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-amber-100 text-amber-700"
                        )}>
                            {paid ? 'Pago' : isOverdue ? 'Atrasada' : isToday ? 'Vence Hoje' : isVirtual ? 'Previsto' : 'Pendente'}
                        </span>
                    </div>

                    {(onEdit || onDelete) && (
                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            {onEdit && (
                                <button 
                                    onClick={() => onEdit(expense)}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                                    title="Editar"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                            )}
                            {onDelete && !isVirtual && (
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
                    <p className="text-muted-foreground text-sm">Gerencie suas contas recorrentes.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                        <button
                            onClick={() => setViewMode('month')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                viewMode === 'month' 
                                    ? "bg-white text-gray-900 shadow-sm" 
                                    : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setViewMode('year')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                viewMode === 'year' 
                                    ? "bg-white text-gray-900 shadow-sm" 
                                    : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            Anual
                        </button>
                    </div>
                    <MonthSelector currentDate={currentMonth} onMonthChange={setCurrentMonth} viewMode={viewMode} />
                </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-col md:flex-row gap-3 w-full">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar despesa..." 
                        className="pl-9 h-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-48">
                    <Select 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="h-10"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="pending">Pendentes</option>
                        <option value="paid">Pagas</option>
                    </Select>
                </div>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                    {filteredExpenses.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">Nenhuma despesa para este {viewMode === 'year' ? 'ano' : 'mês'}.</p>
                            <p className="text-xs text-gray-400 mt-1">Tente mudar o período ou os filtros.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {sortedGroupKeys.map(key => (
                                <div key={key}>
                                    <h4 className={cn(
                                        "text-sm font-semibold capitalize mb-3 ml-1",
                                        viewMode === 'year' ? "text-lg text-[#7E1A8B]" : "text-gray-500"
                                    )}>
                                        {getGroupLabel(key)}
                                    </h4>
                                    <div className="space-y-3">
                                        {groupedExpenses[key].map(expense => (
                                            <TransactionItem key={expense.id} expense={expense} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
