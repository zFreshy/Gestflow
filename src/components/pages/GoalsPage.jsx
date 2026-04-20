import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { Target, TrendingUp, Calendar, ArrowRight, DollarSign, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '../atoms/Input';

export function GoalsPage({ transactions }) {
    const [viewMode, setViewMode] = useState('daily');
    const [visibleCount, setVisibleCount] = useState(10);
    const [expandedId, setExpandedId] = useState(null);

    const { stats, historyStats } = useMemo(() => {
        const getTransactionDate = (dateStr) => {
            if (!dateStr) return new Date(0);
            const [day, month, year] = dateStr.split('/');
            return new Date(year, month - 1, day);
        };
        
        const isPaid = (status) => ['Pago', 'Liberado'].includes(status);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        // Generate Virtual Expenses exactly like Dashboard
        const fixedExpenses = transactions.filter(t => t.type === 'expense' && t.expenseType === 'fixed');
        const recurringGroups = {};
        fixedExpenses.forEach(t => {
            if (t.recurrence) {
                const key = `${t.description}-${t.recurrence}`;
                if (!recurringGroups[key] || getTransactionDate(recurringGroups[key].date) < getTransactionDate(t.date)) {
                    recurringGroups[key] = t;
                }
            }
        });

        const localVirtualExpenses = [];
        Object.values(recurringGroups).forEach(lastExpense => {
            const lastDate = getTransactionDate(lastExpense.date);
            if (lastDate >= todayDate && !isPaid(lastExpense.status)) return;

            let currentDate = new Date(lastDate);
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

            let safetyCounter = 0;
            while (safetyCounter < 60) {
                const isOverdue = currentDate < todayDate;
                const formattedDate = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()}`;
                localVirtualExpenses.push({
                    ...lastExpense,
                    id: `virtual-${lastExpense.id}-${currentDate.getTime()}`,
                    date: formattedDate,
                    status: isOverdue ? 'Atrasado' : 'Aguardando',
                    isVirtual: true,
                    isOverdue: isOverdue
                });
                if (!isOverdue) break;
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

        // Dashboard 'forecast_balance' logic:
        const allTx = [...transactions, ...localVirtualExpenses];
        
        let totalIncomeReal = 0;
        let totalExpensesForecast = 0;
        let maxExpenseDateMs = todayDate.getTime();
        
        let currentMonthIncome = 0;
        const currentMonthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

        allTx.forEach(t => {
            const date = getTransactionDate(t.date);
            if (t.type === 'income') {
                totalIncomeReal += t.amount;
                if (date >= currentMonthStart && date <= todayDate) {
                    currentMonthIncome += t.amount;
                }
            } else if (t.type === 'expense') {
                totalExpensesForecast += t.amount;
                const tDateMs = date.getTime();
                if (tDateMs > maxExpenseDateMs) {
                    maxExpenseDateMs = tDateMs;
                }
            }
        });

        // Quanto precisa ganhar = Total Saídas - Entradas Reais
        let incomeNeeded = totalExpensesForecast - totalIncomeReal;
        if (incomeNeeded < 0) incomeNeeded = 0; // Se já bateu, precisa de 0

        // Cálculos de Dias até a última despesa prevista
        const msPerDay = 1000 * 60 * 60 * 24;
        let remainingDays = Math.ceil((maxExpenseDateMs - todayDate.getTime()) / msPerDay) + 1; // Inclui o dia de hoje
        if (remainingDays < 1) remainingDays = 1;

        // Médias
        const dailyAverageNeeded = incomeNeeded / remainingDays;
        const monthlyAverageNeeded = dailyAverageNeeded * 30; // Aproximação padrão de 30 dias por mês
        
        const currentDay = todayDate.getDate();
        const currentDailyAverage = currentDay > 0 ? currentMonthIncome / currentDay : 0;

        const stats = {
            totalIncomeReal,
            totalExpensesForecast,
            incomeNeeded,
            remainingDays,
            dailyAverageNeeded,
            monthlyAverageNeeded,
            currentDailyAverage
        };

        const days = {};
        const months = {};

        allTx.forEach(t => {
            const date = getTransactionDate(t.date);
            if (isNaN(date.getTime()) || date.getTime() === 0) return;
            
            const dayKey = t.date; // DD/MM/YYYY
            const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            
            if (!days[dayKey]) days[dayKey] = { id: dayKey, label: dayKey, date: date, income: 0, expense: 0, transactions: [] };
            if (!months[monthKey]) months[monthKey] = { id: monthKey, label: monthKey, date: new Date(date.getFullYear(), date.getMonth(), 1), income: 0, expense: 0, transactions: [] };
            
            days[dayKey].transactions.push(t);
            months[monthKey].transactions.push(t);
            
            if (t.type === 'income') {
                days[dayKey].income += t.amount;
                months[monthKey].income += t.amount;
            } else if (t.type === 'expense') {
                days[dayKey].expense += t.amount;
                months[monthKey].expense += t.amount;
            }
        });

        // Filter out future days and months for the history view
        const dayList = Object.values(days)
            .filter(d => d.date <= todayDate)
            .sort((a, b) => b.date - a.date);
            
        const monthList = Object.values(months)
            .filter(m => m.date <= currentMonthStart)
            .sort((a, b) => b.date - a.date);

        return { stats, historyStats: { dayList, monthList } };
    }, [transactions]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Metas do Mês</h1>
                    <p className="text-gray-500 mt-1">Acompanhe quanto você precisa faturar para cobrir suas despesas e bater sua meta de lucro.</p>
                </div>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-emerald-100 shadow-sm relative overflow-hidden bg-white">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start relative z-10">
                            <CardTitle className="text-gray-500 text-sm font-semibold">Entradas até agora</CardTitle>
                            <div className="bg-emerald-100/50 p-2 rounded-xl">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-extrabold tracking-tight text-gray-900">
                            {formatCurrency(stats.totalIncomeReal)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 font-medium">Média atual: <span className="text-gray-700">{formatCurrency(stats.currentDailyAverage)}/dia</span></p>
                    </CardContent>
                </Card>

                <Card className="border-rose-100 shadow-sm relative overflow-hidden bg-white">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start relative z-10">
                            <CardTitle className="text-gray-500 text-sm font-semibold">Saídas (Reais + Previstas)</CardTitle>
                            <div className="bg-rose-100/50 p-2 rounded-xl">
                                <DollarSign className="w-5 h-5 text-rose-600" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-extrabold tracking-tight text-gray-900">
                            {formatCurrency(stats.totalExpensesForecast)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 font-medium">Tudo que já saiu e ainda vai sair</p>
                    </CardContent>
                </Card>

                <Card className="border-purple-100 shadow-sm relative overflow-hidden bg-purple-50">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100/50 rounded-full -mr-12 -mt-12" />
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start relative z-10">
                            <CardTitle className="text-purple-900 text-sm font-bold">Falta Faturar</CardTitle>
                            <div className="bg-white/80 p-2 rounded-xl shadow-sm">
                                <Target className="w-5 h-5 text-purple-700" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-4xl font-black tracking-tight text-purple-900">
                            {formatCurrency(stats.incomeNeeded)}
                        </div>
                        {stats.incomeNeeded === 0 && stats.totalIncomeReal > 0 ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold mt-2">
                                🎉 Meta Atingida!
                            </div>
                        ) : (
                            <p className="text-sm text-purple-700/80 mt-1 font-medium">Para cobrir despesas e meta</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Daily Action Plan */}
                <Card className="shadow-sm border-gray-100">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            Plano de Ação
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col justify-center items-center text-center">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Tempo Restante</p>
                                <div className="text-3xl font-black text-gray-900">{stats.remainingDays} dias</div>
                                <p className="text-xs text-gray-500 mt-1 font-medium">até a última despesa</p>
                            </div>
                            
                            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 flex flex-col justify-center items-center text-center">
                                <p className="text-xs font-bold text-blue-600/80 uppercase tracking-wider mb-1">Meta Diária</p>
                                <div className="text-3xl font-black text-blue-600">{formatCurrency(stats.dailyAverageNeeded)}</div>
                                <p className="text-xs text-blue-600/70 mt-1 font-medium">faturamento por dia</p>
                            </div>

                            <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 flex flex-col justify-center items-center text-center">
                                <p className="text-xs font-bold text-indigo-600/80 uppercase tracking-wider mb-1">Meta Mensal</p>
                                <div className="text-3xl font-black text-indigo-600">{formatCurrency(stats.monthlyAverageNeeded)}</div>
                                <p className="text-xs text-indigo-600/70 mt-1 font-medium">faturamento por mês (30d)</p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-3">
                            <div className="flex justify-between items-center text-sm p-3 bg-white border border-gray-100 rounded-xl">
                                <span className="text-gray-600 font-medium">Total de Saídas (Reais + Previstas)</span>
                                <span className="font-bold text-gray-900">{formatCurrency(stats.totalExpensesForecast)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm p-3 bg-white border border-gray-100 rounded-xl">
                                <span className="text-gray-600 font-medium">Entradas até agora</span>
                                <span className="font-bold text-emerald-600">-{formatCurrency(stats.totalIncomeReal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm p-3 bg-purple-50 border border-purple-100 rounded-xl">
                                <span className="text-purple-900 font-bold">Falta Faturar (Total)</span>
                                <span className="font-black text-purple-900">{formatCurrency(stats.incomeNeeded)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Histórico de Metas */}
            <Card className="shadow-sm border-gray-100">
                <CardHeader className="border-b border-gray-100 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-600" />
                            Acompanhamento de Metas
                        </CardTitle>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => { setViewMode('daily'); setVisibleCount(10); setExpandedId(null); }}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'daily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Por Dia
                            </button>
                            <button
                                onClick={() => { setViewMode('monthly'); setVisibleCount(10); setExpandedId(null); }}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Por Mês
                            </button>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                        Acompanhe se o saldo (entradas - saídas) de cada {viewMode === 'daily' ? 'dia' : 'mês'} atingiu a meta.
                    </p>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                        {(viewMode === 'daily' ? historyStats.dayList : historyStats.monthList)
                            .slice(0, visibleCount)
                            .map(item => {
                            const saldo = item.income - item.expense;
                            const goalToCompare = viewMode === 'daily' ? stats.dailyAverageNeeded : stats.monthlyAverageNeeded;
                            const isMet = saldo >= goalToCompare;
                            const isExpanded = expandedId === item.id;
                            
                            return (
                                <div key={item.id} className="flex flex-col">
                                    <div 
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isMet ? (
                                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-rose-500" />
                                            )}
                                            <div>
                                                <p className="font-semibold text-gray-900">{item.label}</p>
                                                <p className="text-xs text-gray-500">
                                                    Saldo: <span className={saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(saldo)}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right hidden md:block">
                                                <p className={`text-sm font-bold ${isMet ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {isMet ? '+' : ''}{formatCurrency(saldo - goalToCompare)}
                                                </p>
                                                <p className="text-xs text-gray-500">vs meta ({formatCurrency(goalToCompare)})</p>
                                            </div>
                                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                        </div>
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="bg-gray-50 p-4 border-t border-gray-100">
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                                    <p className="text-xs text-gray-500 font-medium">Entradas</p>
                                                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(item.income)}</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                                    <p className="text-xs text-gray-500 font-medium">Saídas</p>
                                                    <p className="text-lg font-bold text-rose-600">{formatCurrency(item.expense)}</p>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <p className="text-xs font-bold text-gray-700 uppercase mb-2">Transações do {viewMode === 'daily' ? 'Dia' : 'Mês'}</p>
                                                <div className="space-y-2">
                                                    {item.transactions.map(t => (
                                                        <div key={t.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100 text-sm">
                                                            <span className="text-gray-700 truncate pr-2">{t.description}</span>
                                                            <span className={`font-medium shrink-0 ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {item.transactions.length === 0 && (
                                                        <div className="text-sm text-gray-500 text-center py-2">Sem transações</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        
                        {(viewMode === 'daily' ? historyStats.dayList : historyStats.monthList).length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                Nenhuma transação encontrada.
                            </div>
                        )}
                    </div>
                    
                    {visibleCount < (viewMode === 'daily' ? historyStats.dayList.length : historyStats.monthList.length) && (
                        <div className="p-4 border-t border-gray-100 flex justify-center">
                            <button
                                onClick={() => setVisibleCount(prev => prev + 10)}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                Carregar mais
                            </button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}