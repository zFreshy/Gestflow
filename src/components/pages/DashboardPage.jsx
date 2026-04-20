import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, DollarSign, TrendingUp, Users, Activity, XCircle, Clock, CheckCircle, Calendar as CalendarIcon, FileText, Search, Flame, Target, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { StatCard } from '../molecules/StatCard';
import { DonutChart } from '../molecules/DonutChart';
import { FinancesChart } from '../organisms/FinancesChart';
import { FixedExpensesSummaryModal } from '../organisms/FixedExpensesSummaryModal';
import { HiddenCostsModal } from '../organisms/HiddenCostsModal';

export function DashboardPage({ transactions }) {
    const [selectedHiddenCost, setSelectedHiddenCost] = useState(null);
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

    // 7. Heatmap (Últimas 12 Semanas = 84 dias)
    const { heatmapDays, heatmapInsight } = useMemo(() => {
        const days = [];
        const numDays = 84;
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Map para acumular por dia da semana (0 = Dom, 1 = Seg, etc.)
        const weekdayProfits = [0, 0, 0, 0, 0, 0, 0];
        const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];

        // Mapear transações por data (timestamp)
        const txByDate = {};
        transactions.forEach(t => {
            const d = getTransactionDate(t.date);
            const ts = d.getTime();
            if (!txByDate[ts]) txByDate[ts] = { income: 0, expense: 0 };
            if (t.type === 'income') txByDate[ts].income += t.amount;
            else if (t.type === 'expense') txByDate[ts].expense += t.amount;
        });

        // Gerar 84 dias
        for (let i = numDays - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const ts = d.getTime();
            const dayTx = txByDate[ts] || { income: 0, expense: 0 };
            const profit = dayTx.income - dayTx.expense;
            
            days.push({
                date: d,
                dateStr: d.toLocaleDateString('pt-BR'),
                profit,
                income: dayTx.income,
                expense: dayTx.expense,
                weekday: d.getDay()
            });

            // Só contar na média se houve alguma movimentação (pra não distorcer)
            if (dayTx.income > 0 || dayTx.expense > 0) {
                weekdayProfits[d.getDay()] += profit;
                weekdayCounts[d.getDay()] += 1;
            }
        }

        // Descobrir melhor e pior dia
        let bestDay = -1;
        let worstDay = -1;
        let maxAvg = -Infinity;
        let minAvg = Infinity;

        const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        weekdayProfits.forEach((total, idx) => {
            const count = weekdayCounts[idx];
            if (count >= 2) { // Exige pelo menos 2 ocorrências para considerar uma "tendência"
                const avg = total / count;
                if (avg > maxAvg) { maxAvg = avg; bestDay = idx; }
                if (avg < minAvg) { minAvg = avg; worstDay = idx; }
            }
        });

        let insight = "Ainda não temos dados suficientes nas últimas semanas para analisar tendências dos seus melhores dias.";
        if (bestDay !== -1 && worstDay !== -1) {
            if (bestDay === worstDay) {
                insight = `Aparentemente **${dayNames[bestDay]}** concentra o maior volume das suas movimentações, tanto de ganhos quanto de despesas.`;
            } else {
                insight = `🔥 Seu melhor dia de lucro médio é **${dayNames[bestDay]}**, mas seu pior dia (onde mais ocorrem despesas ou prejuízos) é **${dayNames[worstDay]}**. Considere remanejar vencimentos de boletos para mais perto de ${dayNames[bestDay]}.`;
            }
        }

        return { heatmapDays: days, heatmapInsight: insight };
    }, [transactions]);

    // 8. Custos Ocultos (Últimos 30 dias)
    const hiddenCosts = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const smallExpenses = {};
        
        // Função simples para normalizar nomes e agrupar parecidos
        const normalizeName = (name) => {
            return name.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
                .replace(/[^a-z0-9]/g, ' ') // remove especiais
                .replace(/\s+/g, ' ') // espacos multiplos
                .trim();
        };

        transactions.forEach(t => {
            if (t.type === 'expense' && !t.supplier_id && t.amount <= 100) { // Consideramos < R$100 como pequeno
                const d = getTransactionDate(t.date);
                if (d >= thirtyDaysAgo) {
                    const normName = normalizeName(t.description);
                    if (normName.length < 3) return; // ignora muito curtos
                    
                    // Acha chave parecida (gambiarra simples: se uma string contem a outra)
                    let matchedKey = Object.keys(smallExpenses).find(k => k.includes(normName) || normName.includes(k));
                    if (!matchedKey) matchedKey = normName;

                    if (!smallExpenses[matchedKey]) {
                        smallExpenses[matchedKey] = { originalName: t.description, count: 0, total: 0, history: [] };
                    }
                    smallExpenses[matchedKey].count += 1;
                    smallExpenses[matchedKey].total += t.amount;
                    smallExpenses[matchedKey].history.push(t);
                }
            }
        });

        // Filtrar apenas os que aconteceram mais de 2 vezes no mês e somam mais de R$ 50
        return Object.values(smallExpenses)
            .filter(item => item.count >= 2 && item.total >= 50)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5); // Top 5
    }, [transactions]);

    // Helper de cor pro heatmap
    const getHeatmapColor = (profit, income, expense) => {
        if (income === 0 && expense === 0) return 'bg-gray-100'; // Neutro/Sem transacao
        if (profit > 0) {
            if (profit > 1000) return 'bg-emerald-600';
            if (profit > 500) return 'bg-emerald-500';
            if (profit > 100) return 'bg-emerald-400';
            return 'bg-emerald-300';
        } else if (profit < 0) {
            if (profit < -1000) return 'bg-rose-600';
            if (profit < -500) return 'bg-rose-500';
            if (profit < -100) return 'bg-rose-400';
            return 'bg-rose-300';
        }
        return 'bg-yellow-300'; // Empate
    };

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

            {/* Heatmap & Hidden Costs Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Heatmap (2 columns) */}
                <div className="lg:col-span-2">
                    <StatCard
                        title="Termômetro de Lucro (Últimas 12 Semanas)"
                        icon={Flame}
                        accent="orange"
                        className="h-full"
                    >
                        <div className="mt-4 relative z-10 flex flex-col h-full gap-4">
                            <div className="flex flex-wrap gap-1.5">
                                {heatmapDays.map((day, i) => (
                                    <div
                                        key={i}
                                        title={`${day.dateStr}\nLucro: ${formatCurrency(day.profit)}\nReceita: ${formatCurrency(day.income)}\nDespesa: ${formatCurrency(day.expense)}`}
                                        className={cn(
                                            "w-4 h-4 sm:w-5 sm:h-5 rounded-[4px] cursor-help transition-all hover:scale-125 hover:z-10 shadow-sm",
                                            getHeatmapColor(day.profit, day.income, day.expense)
                                        )}
                                    />
                                ))}
                            </div>
                            <div className="bg-orange-50/80 p-3.5 rounded-xl border border-orange-100 text-sm text-gray-700 flex items-start gap-2.5 mt-auto">
                                <Flame className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                                <p dangerouslySetInnerHTML={{ __html: heatmapInsight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                            </div>
                        </div>
                    </StatCard>
                </div>

                {/* Hidden Costs (1 column) */}
                <StatCard
                    title="Custos Ocultos (30 dias)"
                    icon={Search}
                    accent="red"
                    className="h-full"
                >
                    <div className="mt-4 relative z-10 flex flex-col h-full gap-3">
                        <p className="text-xs text-gray-500 mb-1">
                            Pequenos gastos frequentes que podem passar despercebidos.
                        </p>
                        {hiddenCosts.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 text-center bg-gray-50/80 rounded-xl border border-dashed border-gray-200 p-4">
                                Nenhum custo oculto detectado! 🎉
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {hiddenCosts.map((item, i) => (
                                    <div 
                                        key={i} 
                                        className="flex justify-between items-center p-3 rounded-xl bg-rose-50/50 border border-rose-100/50 hover:bg-rose-100/80 transition-colors group cursor-pointer"
                                        onClick={() => setSelectedHiddenCost(item)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-gray-800 capitalize flex items-center gap-2">
                                                {item.originalName.toLowerCase()}
                                                <Info className="w-3.5 h-3.5 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </span>
                                            <span className="text-xs text-gray-500 font-medium">{item.count} repetições</span>
                                        </div>
                                        <span className="font-bold text-rose-600">{formatCurrency(item.total)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </StatCard>
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

            <HiddenCostsModal 
                isOpen={selectedHiddenCost !== null}
                onClose={() => setSelectedHiddenCost(null)}
                data={selectedHiddenCost}
            />
        </div>
    );
}
