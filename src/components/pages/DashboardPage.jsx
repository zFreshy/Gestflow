import React from 'react';
import { ArrowUp, ArrowDown, DollarSign, TrendingUp, Users, Activity, XCircle, Clock, CheckCircle, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { StatCard } from '../molecules/StatCard';
import { DonutChart } from '../molecules/DonutChart';
import { FinancesChart } from '../organisms/FinancesChart';

export function DashboardPage({ transactions }) {
    const totalCount = transactions.length;
    
    // Helper to normalize status
    const isPaid = (status) => ['Pago', 'Liberado'].includes(status);
    const isPending = (status) => ['Aguardando', 'Pendente'].includes(status);

    // Helper for date comparison (ignoring time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getTransactionDate = (dateStr) => {
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
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
    
    // New metrics
    const upcomingExpenses = fixedExpenses.filter(t => isPending(t.status) && getTransactionDate(t.date) >= today);
    const overdueExpenses = fixedExpenses.filter(t => isPending(t.status) && getTransactionDate(t.date) < today);
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

    // Calculate averages
    const uniqueDates = [...new Set(transactions.map(t => t.date))].length || 1;
    const uniqueMonths = [...new Set(transactions.map(t => {
        const [d, m, y] = t.date.split('/');
        return `${m}/${y}`;
    }))].length || 1;
    const uniqueYears = [...new Set(transactions.map(t => {
        const [d, m, y] = t.date.split('/');
        return y;
    }))].length || 1;

    const dailyAvgIncome = totalIncome / uniqueDates;
    const dailyAvgExpense = totalExpense / uniqueDates;
    const dailyAvgProfit = dailyAvgIncome - dailyAvgExpense;

    const monthlyAvgIncome = totalIncome / uniqueMonths;
    const monthlyAvgExpense = totalExpense / uniqueMonths;
    const monthlyAvgProfit = monthlyAvgIncome - monthlyAvgExpense;

    const yearlyAvgIncome = totalIncome / uniqueYears;
    const yearlyAvgExpense = totalExpense / uniqueYears;
    const yearlyAvgProfit = yearlyAvgIncome - yearlyAvgExpense;

    return (
        <div className="space-y-6">
            {/* Top Stats Row - Financial Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Card 1 — Lucro Total */}
                <StatCard
                    title="Lucro Total"
                    icon={DollarSign}
                    accent="green"
                >
                    <div className="flex flex-col items-center justify-center py-2 h-full">
                        <span className="text-3xl font-bold tracking-tight text-emerald-600">
                            {formatCurrency(totalIncome)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium mt-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <ArrowUp className="h-3 w-3" />
                            <span>Receitas</span>
                        </div>
                    </div>
                </StatCard>

                {/* Card 2 — Despesas Totais */}
                <StatCard
                    title="Despesas Totais"
                    icon={DollarSign}
                    accent="red"
                >
                    <div className="flex flex-col items-center justify-center py-2 h-full">
                        <span className="text-3xl font-bold tracking-tight text-red-600">
                            {formatCurrency(totalExpense)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-red-600 font-medium mt-1 bg-red-50 px-2 py-0.5 rounded-full">
                            <ArrowDown className="h-3 w-3" />
                            <span>Gastos</span>
                        </div>
                    </div>
                </StatCard>

                {/* Card 3 — Lucro Líquido */}
                <StatCard
                    title="Lucro Líquido"
                    icon={TrendingUp}
                    accent="blue"
                >
                    <div className="flex flex-col items-center justify-center py-2 h-full">
                        <span className={cn(
                            "text-3xl font-bold tracking-tight",
                            netProfit >= 0 ? "text-blue-600" : "text-red-600"
                        )}>
                            {formatCurrency(netProfit)}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">Saldo Atual</p>
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
                    <div className="flex flex-col items-center justify-center py-2 h-full">
                        <span className="text-2xl font-bold tracking-tight text-amber-600">
                            {formatCurrency(upcomingTotal)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-amber-600 font-medium mt-1 bg-amber-50 px-2 py-0.5 rounded-full">
                            <span>{upcomingExpenses.length} pendentes</span>
                        </div>
                    </div>
                </StatCard>

                {/* Despesas Atrasadas */}
                <StatCard
                    title="Despesas Atrasadas"
                    icon={XCircle}
                    accent="red"
                >
                    <div className="flex flex-col items-center justify-center py-2 h-full">
                        <span className="text-2xl font-bold tracking-tight text-red-600">
                            {formatCurrency(overdueTotal)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-red-600 font-medium mt-1 bg-red-50 px-2 py-0.5 rounded-full">
                            <span>{overdueExpenses.length} vencidas</span>
                        </div>
                    </div>
                </StatCard>

                {/* Despesas Fixas Pagas */}
                <StatCard
                    title="Despesas Fixas Pagas"
                    icon={CheckCircle}
                    accent="green"
                >
                    <div className="flex flex-col items-center justify-center py-2 h-full">
                        <span className="text-2xl font-bold tracking-tight text-emerald-600">
                            {formatCurrency(paidFixedTotal)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium mt-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <span>{paidFixedExpenses.length} pagas</span>
                        </div>
                    </div>
                </StatCard>
            </div>

            {/* Chart Full Width */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <FinancesChart transactions={transactions} />
            </div>

            {/* Averages Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Averages */}
                <StatCard
                    title="Média Diária"
                    icon={Activity}
                    accent="blue"
                >
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Lucro</span>
                            <span className="font-medium text-emerald-600">{formatCurrency(dailyAvgIncome)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Despesa</span>
                            <span className="font-medium text-red-600">{formatCurrency(dailyAvgExpense)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t">
                            <span className="font-medium text-gray-700">Saldo</span>
                            <span className={cn("font-bold", dailyAvgProfit >= 0 ? "text-blue-600" : "text-red-600")}>
                                {formatCurrency(dailyAvgProfit)}
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
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Lucro</span>
                            <span className="font-medium text-emerald-600">{formatCurrency(monthlyAvgIncome)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Despesa</span>
                            <span className="font-medium text-red-600">{formatCurrency(monthlyAvgExpense)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t">
                            <span className="font-medium text-gray-700">Saldo</span>
                            <span className={cn("font-bold", monthlyAvgProfit >= 0 ? "text-blue-600" : "text-red-600")}>
                                {formatCurrency(monthlyAvgProfit)}
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
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Lucro</span>
                            <span className="font-medium text-emerald-600">{formatCurrency(yearlyAvgIncome)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Despesa</span>
                            <span className="font-medium text-red-600">{formatCurrency(yearlyAvgExpense)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t">
                            <span className="font-medium text-gray-700">Saldo</span>
                            <span className={cn("font-bold", yearlyAvgProfit >= 0 ? "text-blue-600" : "text-red-600")}>
                                {formatCurrency(yearlyAvgProfit)}
                            </span>
                        </div>
                    </div>
                </StatCard>
            </div>

            {/* Bottom Stats Row - Secondary Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Card 1 — Pacientes (Total) */}
                <StatCard
                    title="Pacientes"
                    icon={Users}
                    accent="blue"
                >
                    <div className="flex flex-col items-center justify-center py-2 h-full">
                        <span className="text-4xl font-bold tracking-tight text-gray-900">268</span>
                        <p className="text-xs text-muted-foreground mt-1">Total</p>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-4 pt-4 border-t border-gray-100">
                        <span className="text-emerald-500 font-medium">+12 clientes novos</span>
                        <span className="text-emerald-500 font-medium flex items-center gap-0.5"><TrendingUp className="h-3 w-3" /> 43%</span>
                    </div>
                </StatCard>

                {/* Card 2 — Tipos de Extratos */}
                <StatCard
                    title="Tipos de Extratos"
                    icon={Activity}
                    accent="yellow"
                >
                    <div className="flex items-center justify-around mt-4 h-full pb-2">
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-blue-500" />
                                <span className="text-2xl font-bold text-gray-900">{fixedExpenses.length}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 font-medium">Obrigatórios</p>
                            <span className="text-[10px] text-gray-500 font-semibold mt-1">{formatCurrency(fixedTotal)}</span>
                        </div>
                        <div className="h-10 w-px bg-gray-200"></div>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-500" />
                                <span className="text-2xl font-bold text-gray-900">{variableExpenses.length}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 font-medium">Variáveis</p>
                            <span className="text-[10px] text-gray-500 font-semibold mt-1">{formatCurrency(variableTotal)}</span>
                        </div>
                    </div>
                </StatCard>

                {/* Card 3 — Donut chart */}
                <StatCard
                    title="Exames por Convênios"
                    icon={Users}
                    accent="purple"
                >
                    <div className="mt-2 h-24">
                        <DonutChart transactions={transactions} />
                    </div>
                </StatCard>
            </div>
        </div>
    );
}
