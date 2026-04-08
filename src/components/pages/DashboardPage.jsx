import React, { useState } from 'react';
import { ArrowUp, ArrowDown, DollarSign, TrendingUp, Users, Activity, XCircle, Clock, CheckCircle, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import { StatCard } from '../molecules/StatCard';
import { DonutChart } from '../molecules/DonutChart';
import { FinancesChart } from '../organisms/FinancesChart';
import { FixedExpensesSummaryModal } from '../organisms/FixedExpensesSummaryModal';

export function DashboardPage({ transactions }) {
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const totalCount = transactions.length;
    
    // Helper to normalize status
    const isPaid = (status) => ['Pago', 'Liberado'].includes(status);
    const isPending = (status) => ['Aguardando', 'Pendente'].includes(status);

    // Helper for date comparison (ignoring time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getTransactionDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    };

    // Helper: Calculate next occurrence for recurring expenses
    const calculateNextOccurrence = (expense) => {
        const expenseDate = getTransactionDate(expense.date);
        
        // If expense is in the future, that's the next occurrence
        if (expenseDate >= today) return expenseDate;

        // If in the past, calculate next based on recurrence
        let nextDate = new Date(expenseDate);
        while (nextDate < today) {
            switch (expense.recurrence?.toLowerCase()) {
                case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
                case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
                case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
                case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
                case 'semiannual': nextDate.setMonth(nextDate.getMonth() + 6); break;
                case 'annual': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
                case 'biennial': nextDate.setFullYear(nextDate.getFullYear() + 2); break;
                default: nextDate.setMonth(nextDate.getMonth() + 1);
            }
        }
        return nextDate;
    };

    // Calculate financial totals
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((acc, curr) => acc + curr.amount, 0);
        
    // Total expense now considers:
    // 1. Variable expenses: ALL of them
    // 2. Fixed expenses: ONLY if status is Paid
    const totalExpense = transactions
        .filter(t => {
            if (t.type !== 'expense') return false;
            if (t.expenseType === 'fixed') {
                return isPaid(t.status);
            }
            return true; // Variable expenses always count
        })
        .reduce((acc, curr) => acc + curr.amount, 0);
        
    const netProfit = totalIncome - totalExpense;

    // Filter for cards
    const fixedExpenses = transactions.filter(t => t.type === 'expense' && t.expenseType === 'fixed');
    const variableExpenses = transactions.filter(t => t.type === 'expense' && t.expenseType === 'variable');
    
    // Generate Virtual Expenses for Projections
    const recurringGroups = {};
    fixedExpenses.forEach(t => {
        if (t.recurrence) {
            const key = `${t.description}-${t.recurrence}`;
            if (!recurringGroups[key] || getTransactionDate(recurringGroups[key].date) < getTransactionDate(t.date)) {
                recurringGroups[key] = t;
            }
        }
    });

    const virtualExpenses = [];
    Object.values(recurringGroups).forEach(lastExpense => {
        const lastDate = getTransactionDate(lastExpense.date);
        
        // If the last expense is in the future/today and unpaid, it's already in the list.
        if (lastDate >= today && !isPaid(lastExpense.status)) return;

        let currentDate = new Date(lastDate);
        
        // Advance to next occurrence initially
        switch (lastExpense.recurrence?.toLowerCase()) {
            case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
            case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
            case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
            case 'quarterly': currentDate.setMonth(currentDate.getMonth() + 3); break;
            case 'semiannual': currentDate.setMonth(currentDate.getMonth() + 6); break;
            case 'annual': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
            case 'biennial': currentDate.setFullYear(currentDate.getFullYear() + 2); break;
            default: currentDate.setMonth(currentDate.getMonth() + 1);
        }

        // Generate all missing occurrences up to the first future one
        // We limit the loop to avoid infinite loops in case of errors (e.g. 5 years)
        let safetyCounter = 0;
        while (safetyCounter < 60) { // Max 5 years of monthly occurrences
            const isOverdue = currentDate < today;
            
            virtualExpenses.push({
                ...lastExpense,
                id: `virtual-${lastExpense.id}-${currentDate.getTime()}`,
                date: currentDate.toLocaleDateString('pt-BR'),
                status: isOverdue ? 'Atrasado' : 'Aguardando',
                isVirtual: true,
                isOverdue: isOverdue
            });

            // If we just added a future occurrence, we stop (showing only the next upcoming one)
            if (!isOverdue) break;

            // Advance to next occurrence
            switch (lastExpense.recurrence?.toLowerCase()) {
                case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
                case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
                case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
                case 'quarterly': currentDate.setMonth(currentDate.getMonth() + 3); break;
                case 'semiannual': currentDate.setMonth(currentDate.getMonth() + 6); break;
                case 'annual': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
                case 'biennial': currentDate.setFullYear(currentDate.getFullYear() + 2); break;
                default: currentDate.setMonth(currentDate.getMonth() + 1);
            }
            safetyCounter++;
        }
    });

    // New metrics
    const realUpcoming = fixedExpenses.filter(t => isPending(t.status) && getTransactionDate(t.date) >= today);
    const virtualUpcoming = virtualExpenses.filter(t => !t.isOverdue);
    const upcomingExpenses = [...realUpcoming, ...virtualUpcoming];
    
    const realOverdue = fixedExpenses.filter(t => isPending(t.status) && getTransactionDate(t.date) < today);
    const virtualOverdue = virtualExpenses.filter(t => t.isOverdue);
    const overdueExpenses = [...realOverdue, ...virtualOverdue];

    const paidFixedExpenses = fixedExpenses.filter(t => isPaid(t.status));

    const upcomingTotal = upcomingExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const overdueTotal = overdueExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const paidFixedTotal = paidFixedExpenses.reduce((acc, curr) => acc + curr.amount, 0);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const fixedTotal = fixedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const variableTotal = variableExpenses.reduce((acc, curr) => acc + curr.amount, 0);

    // 6. Period Totals (Logic replicated from Mobile)
    const todayStr = today.toLocaleDateString('pt-BR');
    const currentYear = today.getFullYear();

    // Daily: Today
    const dailyTxs = transactions.filter(t => {
        const d = getTransactionDate(t.date);
        return d.toLocaleDateString('pt-BR') === todayStr;
    });
    
    // Monthly: Current Month
    const monthlyTxs = transactions.filter(t => {
        const d = getTransactionDate(t.date);
        return (d.getMonth() + 1) === (today.getMonth() + 1) && d.getFullYear() === currentYear;
    });

    // Yearly: Current Year
    const yearlyTxs = transactions.filter(t => {
        const d = getTransactionDate(t.date);
        return d.getFullYear() === currentYear;
    });

    const calculateStats = (txs) => {
        const inc = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const exp = txs.filter(t => {
            if (t.type !== 'expense') return false;
            if (t.expenseType === 'fixed') return isPaid(t.status);
            return true;
        }).reduce((acc, t) => acc + t.amount, 0);
        return { income: inc, expense: exp, profit: inc - exp };
    };

    const dailyStats = calculateStats(dailyTxs);
    const monthlyStats = calculateStats(monthlyTxs);
    const yearlyStats = calculateStats(yearlyTxs);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Stats Row - Financial Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Card 1 — Saldo Real (Donut) */}
                <StatCard
                    title="Saldo Real"
                    icon={DollarSign}
                    accent="green"
                >
                    <div className="mt-2 min-h-[7rem] w-full relative z-10">
                        <DonutChart transactions={transactions} type="real_balance" />
                    </div>
                </StatCard>

                {/* Card 2 — Saldo Previsto (Donut) */}
                <StatCard
                    title="Saldo Previsto"
                    icon={TrendingUp}
                    accent="blue"
                >
                    <div className="mt-2 min-h-[7rem] w-full relative z-10">
                        <DonutChart transactions={[...transactions, ...virtualExpenses]} type="forecast_balance" />
                    </div>
                </StatCard>
            </div>

            {/* Expenses Status Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Despesas por vir */}
                <StatCard
                    title="Despesas por Vir"
                    icon={Clock}
                    accent="yellow"
                >
                    <div className="flex flex-col items-center justify-center py-4 h-full relative z-10">
                        <span className="text-3xl font-extrabold tracking-tight text-amber-600 mb-2">
                            {formatCurrency(upcomingTotal)}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 font-bold mt-1 bg-amber-100/50 px-3 py-1 rounded-full border border-amber-200/50">
                            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            {upcomingExpenses.length} pendentes
                        </div>
                    </div>
                </StatCard>

                {/* Despesas Atrasadas */}
                <StatCard
                    title="Despesas Atrasadas"
                    icon={XCircle}
                    accent="red"
                >
                    <div className="flex flex-col items-center justify-center py-4 h-full relative z-10">
                        <span className="text-3xl font-extrabold tracking-tight text-rose-600 mb-2">
                            {formatCurrency(overdueTotal)}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-rose-700 font-bold mt-1 bg-rose-100/50 px-3 py-1 rounded-full border border-rose-200/50">
                            <span className="flex h-2 w-2 rounded-full bg-rose-500" />
                            {overdueExpenses.length} vencidas
                        </div>
                    </div>
                </StatCard>

                {/* Despesas Fixas Pagas */}
                <StatCard
                    title="Despesas Fixas Pagas"
                    icon={CheckCircle}
                    accent="green"
                >
                    <div className="flex flex-col items-center justify-center py-4 h-full relative z-10">
                        <span className="text-3xl font-extrabold tracking-tight text-emerald-600 mb-2">
                            {formatCurrency(paidFixedTotal)}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold mt-1 bg-emerald-100/50 px-3 py-1 rounded-full border border-emerald-200/50">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                            {paidFixedExpenses.length} pagas
                        </div>
                    </div>
                </StatCard>
            </div>

            {/* Chart Full Width */}
            <div className="bg-white rounded-3xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-gray-100/80 p-2 overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/30 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                    <FinancesChart transactions={transactions} />
                </div>
            </div>

            {/* Averages Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Averages */}
                <StatCard
                    title="Média Diária"
                    icon={Activity}
                    accent="blue"
                >
                    <div className="flex flex-col gap-3 mt-4 relative z-10">
                        <div className="flex justify-between items-center text-[15px]">
                            <span className="text-gray-500 font-medium">Lucro</span>
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{formatCurrency(dailyStats.income)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[15px]">
                            <span className="text-gray-500 font-medium">Despesa</span>
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">{formatCurrency(dailyStats.expense)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[15px] pt-3 border-t border-gray-100/80">
                            <span className="font-bold text-gray-800">Saldo</span>
                            <span className={cn("font-extrabold text-lg", dailyStats.profit >= 0 ? "text-blue-600" : "text-rose-600")}>
                                {formatCurrency(dailyStats.profit)}
                            </span>
                        </div>
                    </div>
                </StatCard>

                {/* Monthly Averages */}
                <StatCard
                    title="Média Mensal"
                    icon={CalendarIcon}
                    accent="purple"
                >
                    <div className="flex flex-col gap-3 mt-4 relative z-10">
                        <div className="flex justify-between items-center text-[15px]">
                            <span className="text-gray-500 font-medium">Lucro</span>
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{formatCurrency(monthlyStats.income)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[15px]">
                            <span className="text-gray-500 font-medium">Despesa</span>
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">{formatCurrency(monthlyStats.expense)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[15px] pt-3 border-t border-gray-100/80">
                            <span className="font-bold text-gray-800">Saldo</span>
                            <span className={cn("font-extrabold text-lg", monthlyStats.profit >= 0 ? "text-blue-600" : "text-rose-600")}>
                                {formatCurrency(monthlyStats.profit)}
                            </span>
                        </div>
                    </div>
                </StatCard>

                {/* Yearly Averages */}
                <StatCard
                    title="Média Anual"
                    icon={CalendarIcon}
                    accent="orange"
                >
                    <div className="flex flex-col gap-3 mt-4 relative z-10">
                        <div className="flex justify-between items-center text-[15px]">
                            <span className="text-gray-500 font-medium">Lucro</span>
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{formatCurrency(yearlyStats.income)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[15px]">
                            <span className="text-gray-500 font-medium">Despesa</span>
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">{formatCurrency(yearlyStats.expense)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[15px] pt-3 border-t border-gray-100/80">
                            <span className="font-bold text-gray-800">Saldo</span>
                            <span className={cn("font-extrabold text-lg", yearlyStats.profit >= 0 ? "text-blue-600" : "text-rose-600")}>
                                {formatCurrency(yearlyStats.profit)}
                            </span>
                        </div>
                    </div>
                </StatCard>
            </div>

            {/* Bottom Stats Row - Secondary Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
                {/* Card 1 — Lucros por Convênio */}
                <StatCard
                    title="Lucros por Convênio"
                    icon={DollarSign}
                    accent="blue"
                >
                    <div className="mt-2 min-h-[7rem] w-full relative z-10">
                        <DonutChart transactions={transactions} type="payment_methods" />
                    </div>
                </StatCard>

                {/* Card 2 — Saldo Total */}
                <StatCard
                    title="Saldo Total"
                    icon={DollarSign}
                    accent="green"
                >
                    <div className="flex flex-col items-center justify-center py-2 h-full relative z-10">
                        <span className={cn(
                            "text-4xl font-extrabold tracking-tight",
                            netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                            {formatCurrency(netProfit)}
                        </span>
                        <p className="text-xs text-gray-500 font-medium mt-1">Saldo Atual</p>
                    </div>
                </StatCard>

                {/* Card 3 — Resumo Despesas Fixas */}
                <div 
                    onClick={() => setIsSummaryModalOpen(true)}
                    className="cursor-pointer group h-full"
                >
                    <StatCard
                        title="Despesas Fixas e Planejadas"
                        icon={FileText}
                        accent="purple"
                        className="h-full"
                    >
                        <div className="flex flex-col items-center justify-center py-4 h-full gap-4 relative z-10">
                            <div className="h-16 w-16 bg-purple-50 group-hover:bg-purple-100 rounded-full flex items-center justify-center text-purple-600 transition-colors shadow-sm border border-purple-100/50">
                                <FileText className="h-8 w-8 group-hover:scale-110 transition-transform" />
                            </div>
                            <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 text-center transition-colors">
                                Ver resumo detalhado de pagamentos
                            </span>
                        </div>
                    </StatCard>
                </div>
            </div>

            <FixedExpensesSummaryModal 
                isOpen={isSummaryModalOpen} 
                onClose={() => setIsSummaryModalOpen(false)} 
                transactions={transactions} 
            />
        </div>
    );
}
