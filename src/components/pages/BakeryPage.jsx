import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { StatCard } from '../molecules/StatCard';
import { MonthSelector } from '../molecules/MonthSelector';
import { GrowthEvolutionChart } from '../organisms/GrowthEvolutionChart';
import { Store, TrendingUp, TrendingDown, Calendar as CalendarIcon, ArrowUpRight, DollarSign, Activity, Flame, X, Target, CreditCard, BarChart3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PieChart, Pie, Cell as PieCell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function BakeryPage({ transactions }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('month'); // 'month' | 'year'
    const [visibleCount, setVisibleCount] = useState(10);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

    useEffect(() => {
        setVisibleCount(10);
    }, [currentDate, viewMode]);

    // 1. Filtrar as transações apenas da Padaria (Income com a flag)
    const bakeryTxs = useMemo(() => {
        return transactions.filter(t => t.type === 'income' && (t.isBakeryIncome || t.is_bakery_income));
    }, [transactions]);

    // Função utilitária para pegar Data da transação zerada (meia-noite)
    const getTransactionDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    };

    // Formatador de Moeda
    const formatBRL = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    // 2. Cálculos de Estatísticas de Crescimento (Semana Atual x Anterior e Mês Atual x Anterior)
    const stats = useMemo(() => {
        const now = new Date();
        now.setHours(0,0,0,0);
        
        const currentDayOfWeek = now.getDay(); // 0 = Domingo
        const msPerDay = 1000 * 60 * 60 * 24;

        // Encontrar início da semana atual (Domingo)
        const startOfCurrentWeek = new Date(now.getTime() - (currentDayOfWeek * msPerDay));
        const endOfCurrentWeek = new Date(startOfCurrentWeek.getTime() + (6 * msPerDay));
        
        // Encontrar início e fim da semana passada
        const startOfLastWeek = new Date(startOfCurrentWeek.getTime() - (7 * msPerDay));
        const endOfLastWeek = new Date(startOfCurrentWeek.getTime() - (1 * msPerDay));

        // Meses
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        let currentWeekTotal = 0;
        let lastWeekTotal = 0;
        let currentMonthTotal = 0;
        let lastMonthTotal = 0;

        bakeryTxs.forEach(t => {
            const d = getTransactionDate(t.date);
            const ms = d.getTime();

            // Semanas
            if (ms >= startOfCurrentWeek.getTime() && ms <= endOfCurrentWeek.getTime()) {
                currentWeekTotal += t.amount;
            } else if (ms >= startOfLastWeek.getTime() && ms <= endOfLastWeek.getTime()) {
                lastWeekTotal += t.amount;
            }

            // Meses
            if (ms >= startOfCurrentMonth.getTime() && ms <= endOfCurrentMonth.getTime()) {
                currentMonthTotal += t.amount;
            } else if (ms >= startOfLastMonth.getTime() && ms <= endOfLastMonth.getTime()) {
                lastMonthTotal += t.amount;
            }
        });

        // Calcular porcentagens
        const calcPercent = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const weekGrowth = calcPercent(currentWeekTotal, lastWeekTotal);
        const monthGrowth = calcPercent(currentMonthTotal, lastMonthTotal);

        return {
            currentWeekTotal, lastWeekTotal, weekGrowth,
            currentMonthTotal, lastMonthTotal, monthGrowth
        };
    }, [bakeryTxs]);

    // 3. Termômetro de Lucro (Heatmap 84 dias como o Dashboard)
    const { heatmapDays, heatmapInsight } = useMemo(() => {
        const days = [];
        const numDays = 84;
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const weekdayProfits = [0, 0, 0, 0, 0, 0, 0];
        const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];

        const txByDate = {};
        bakeryTxs.forEach(t => {
            const d = getTransactionDate(t.date);
            const ts = d.getTime();
            if (!txByDate[ts]) txByDate[ts] = { profit: 0 };
            txByDate[ts].profit += t.amount;
        });

        for (let i = numDays - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const ts = d.getTime();
            const profit = txByDate[ts]?.profit || 0;
            
            days.push({
                date: d,
                dateStr: d.toLocaleDateString('pt-BR'),
                profit,
                weekday: d.getDay()
            });

            if (profit > 0) {
                weekdayProfits[d.getDay()] += profit;
                weekdayCounts[d.getDay()] += 1;
            }
        }

        let bestDay = -1;
        let maxAvg = -Infinity;
        const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        weekdayProfits.forEach((total, idx) => {
            const count = weekdayCounts[idx];
            if (count >= 2) {
                const avg = total / count;
                if (avg > maxAvg) { maxAvg = avg; bestDay = idx; }
            }
        });

        let insight = "Ainda não temos dados suficientes nas últimas semanas para analisar tendências dos seus melhores dias na padaria.";
        if (bestDay !== -1) {
            insight = `🔥 Seu melhor dia de lucro médio na padaria é **${dayNames[bestDay]}**.`;
        }

        return { heatmapDays: days, heatmapInsight: insight };
    }, [bakeryTxs]);

    const getHeatmapColor = (profit) => {
        if (profit === 0) return 'bg-gray-100';
        if (profit > 1000) return 'bg-emerald-600';
        if (profit > 500) return 'bg-emerald-500';
        if (profit > 100) return 'bg-emerald-400';
        return 'bg-emerald-300';
    };

    // 4. Preparar Histórico (Lista) baseado na seleção (Mês ou Ano)
    const historyData = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Agrupar por data
        const grouped = {};

        bakeryTxs.forEach(t => {
            const d = getTransactionDate(t.date);
            const tYear = d.getFullYear();
            const tMonth = d.getMonth();
            const tDay = d.getDate();

            if (viewMode === 'month') {
                // Filtra pelo mês e ano selecionados
                if (tYear === year && tMonth === month) {
                    const key = `${tDay.toString().padStart(2, '0')}/${(tMonth + 1).toString().padStart(2, '0')}`;
                    if (!grouped[key]) grouped[key] = { key, label: `Dia ${tDay}`, value: 0, dateObj: d };
                    grouped[key].value += t.amount;
                }
            } else if (viewMode === 'year') {
                // Filtra pelo ano selecionado, agrupando por mês
                if (tYear === year) {
                    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                    const key = monthNames[tMonth];
                    if (!grouped[key]) grouped[key] = { key, label: key, value: 0, monthIndex: tMonth };
                    grouped[key].value += t.amount;
                }
            }
        });

        let sortedArray = [];
        if (viewMode === 'month') {
            sortedArray = Object.values(grouped).sort((a, b) => b.dateObj - a.dateObj); // Mais recente primeiro para a lista
        } else {
            sortedArray = Object.values(grouped).sort((a, b) => b.monthIndex - a.monthIndex); // Dez -> Jan para a lista
        }

        const maxValue = Math.max(...sortedArray.map(item => item.value), 1);

        // Adicionar cor para a lista
        const finalListArray = sortedArray.map(item => {
            const intensity = item.value / maxValue;
            return { ...item, intensity };
        });

        return { list: finalListArray, totalPeriod: sortedArray.reduce((acc, curr) => acc + curr.value, 0) };
    }, [bakeryTxs, currentDate, viewMode]);

    const visibleList = historyData.list.slice(0, visibleCount);

    // 5. Transações para o Modal (Quando clica em um item do histórico)
    const modalTransactions = useMemo(() => {
        if (!selectedHistoryItem) return [];
        return bakeryTxs.filter(t => {
            const d = getTransactionDate(t.date);
            const tYear = d.getFullYear();
            const tMonth = d.getMonth();
            const tDay = d.getDate();

            if (viewMode === 'month') {
                return tYear === selectedHistoryItem.dateObj.getFullYear() &&
                       tMonth === selectedHistoryItem.dateObj.getMonth() &&
                       tDay === selectedHistoryItem.dateObj.getDate();
            } else {
                return tYear === currentDate.getFullYear() &&
                       tMonth === selectedHistoryItem.monthIndex;
            }
        });
    }, [selectedHistoryItem, bakeryTxs, viewMode, currentDate]);

    // 6. Forecast (Projeção do Mês Atual)
    const forecastData = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const daysPassed = now.getDate();
        
        // Total de dias no mês atual
        const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        let currentMonthTotal = 0;
        bakeryTxs.forEach(t => {
            const d = getTransactionDate(t.date);
            if (d.getFullYear() === currentYear && d.getMonth() === currentMonth && d.getDate() <= daysPassed) {
                currentMonthTotal += t.amount;
            }
        });
        
        const avgDaily = daysPassed > 0 ? currentMonthTotal / daysPassed : 0;
        const projectedTotal = avgDaily * totalDaysInMonth;
        
        return {
            currentMonthTotal,
            projectedTotal,
            avgDaily,
            daysPassed,
            totalDaysInMonth,
            percentageCompleted: Math.min((daysPassed / totalDaysInMonth) * 100, 100)
        };
    }, [bakeryTxs]);

    // 7. Análise por Dia da Semana e Método de Pagamento (Baseado no Filtro Atual)
    const { weekdayData, paymentData } = useMemo(() => {
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
        const paymentMethods = {};

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        bakeryTxs.forEach(t => {
            const d = getTransactionDate(t.date);
            const tYear = d.getFullYear();
            const tMonth = d.getMonth();
            
            let isInPeriod = false;
            if (viewMode === 'month') {
                isInPeriod = (tYear === year && tMonth === month);
            } else {
                isInPeriod = (tYear === year);
            }

            if (isInPeriod) {
                // Dia da Semana
                weekdayTotals[d.getDay()] += t.amount;

                // Método de Pagamento
                let method = t.paymentMethod || t.payment_method || 'dinheiro';
                if(method === 'cartao') method = 'Cartão de Crédito';
                if(method === 'debito') method = 'Cartão de Débito';
                if(method === 'credito_loja') method = 'Crédito Loja (Fiado)';
                if(method === 'vale_alimentacao') method = 'Vale Alimentação';
                if(method === 'vale_combustivel') method = 'Vale Combustível';
                
                let formatMethod = method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' ');
                if (!paymentMethods[formatMethod]) paymentMethods[formatMethod] = 0;
                paymentMethods[formatMethod] += t.amount;
            }
        });

        const formattedWeekdayData = dayNames.map((name, index) => ({
            name,
            total: weekdayTotals[index]
        }));

        const formattedPaymentData = Object.entries(paymentMethods)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { weekdayData: formattedWeekdayData, paymentData: formattedPaymentData };
    }, [bakeryTxs, currentDate, viewMode]);

    const PIE_COLORS = ['#10b981', '#34d399', '#059669', '#6ee7b7', '#047857', '#a7f3d0'];

    const CustomTooltipChart = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-md border border-gray-100 rounded-2xl shadow-lg p-3 text-sm">
                    <p className="font-bold text-gray-800 mb-1">{payload[0].payload.name || label}</p>
                    <p className="font-bold text-emerald-600">{formatBRL(payload[0].value)}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Store className="w-6 h-6 text-amber-600" />
                        Padaria
                    </h1>
                    <p className="text-sm text-gray-500">Análise de lucros e faturamento exclusivo da padaria.</p>
                </div>
            </div>

            {/* Comparativos Rápidos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Semana */}
                <Card className="border-gray-100 shadow-sm rounded-2xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 opacity-50"></div>
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                                <Activity className="w-5 h-5" />
                            </div>
                            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${stats.weekGrowth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {stats.weekGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(stats.weekGrowth).toFixed(1)}% vs anterior
                            </div>
                        </div>
                        <p className="text-sm font-semibold text-gray-500 mb-1">Lucro Semana Atual</p>
                        <h3 className="text-3xl font-black text-gray-900">{formatBRL(stats.currentWeekTotal)}</h3>
                        <p className="text-xs text-gray-400 mt-2 font-medium">Semana passada: {formatBRL(stats.lastWeekTotal)}</p>
                    </CardContent>
                </Card>

                {/* Mês */}
                <Card className="border-gray-100 shadow-sm rounded-2xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 opacity-50"></div>
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                                <CalendarIcon className="w-5 h-5" />
                            </div>
                            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${stats.monthGrowth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {stats.monthGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(stats.monthGrowth).toFixed(1)}% vs anterior
                            </div>
                        </div>
                        <p className="text-sm font-semibold text-gray-500 mb-1">Lucro Mês Atual</p>
                        <h3 className="text-3xl font-black text-gray-900">{formatBRL(stats.currentMonthTotal)}</h3>
                        <p className="text-xs text-gray-400 mt-2 font-medium">Mês passado: {formatBRL(stats.lastMonthTotal)}</p>
                    </CardContent>
                </Card>

                {/* Projeção do Mês (Forecast) */}
                <Card className="border-gray-100 shadow-sm rounded-2xl overflow-hidden relative bg-gradient-to-br from-indigo-50/50 to-purple-50/50">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-bl-full -z-10 opacity-50"></div>
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                                <Target className="w-5 h-5" />
                            </div>
                            <div className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 bg-white text-purple-700 border border-purple-100 shadow-sm">
                                {forecastData.daysPassed} de {forecastData.totalDaysInMonth} dias
                            </div>
                        </div>
                        <p className="text-sm font-semibold text-gray-500 mb-1">Projeção Fechamento Mês</p>
                        <h3 className="text-3xl font-black text-gray-900">{formatBRL(forecastData.projectedTotal)}</h3>
                        <div className="mt-2.5 w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                                className="bg-purple-500 h-1.5 rounded-full transition-all duration-1000" 
                                style={{ width: `${forecastData.percentageCompleted}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5 font-medium text-right">Baseado na média diária de {formatBRL(forecastData.avgDaily)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Evolução de Crescimento (%) */}
            <GrowthEvolutionChart transactions={bakeryTxs} />

            {/* Análise por Dia da Semana e Métodos de Pagamento */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-gray-100 shadow-sm rounded-2xl">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-500" />
                            Lucro por Dia da Semana
                        </CardTitle>
                        <p className="text-xs text-gray-500 font-medium">Desempenho no período selecionado</p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weekdayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        tickFormatter={(value) => `R$ ${value}`}
                                    />
                                    <Tooltip content={<CustomTooltipChart />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={30} fill="#3b82f6" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-gray-100 shadow-sm rounded-2xl">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-indigo-500" />
                            Métodos de Pagamento
                        </CardTitle>
                        <p className="text-xs text-gray-500 font-medium">Distribuição no período selecionado</p>
                    </CardHeader>
                    <CardContent>
                        {paymentData.length === 0 ? (
                            <div className="h-64 flex items-center justify-center text-gray-400 font-medium bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                Sem dados para o período.
                            </div>
                        ) : (
                            <div className="h-64 w-full mt-2 flex flex-col md:flex-row items-center">
                                <div className="h-full w-full md:w-1/2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={paymentData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {paymentData.map((entry, index) => (
                                                    <PieCell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltipChart />} />
                                         </PieChart>
                                     </ResponsiveContainer>
                                 </div>
                                 <div className="w-full md:w-1/2 flex flex-col gap-3 justify-center pl-4 mt-4 md:mt-0 overflow-y-auto max-h-[240px]">
                                     {paymentData.map((item, index) => (
                                        <div key={index} className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    className="w-3 h-3 rounded-full" 
                                                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                                                ></div>
                                                <span className="font-semibold text-gray-700 capitalize truncate max-w-[120px]">{item.name}</span>
                                            </div>
                                            <span className="font-black text-gray-900">{formatBRL(item.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Termômetro de Lucros (Estilo Github Heatmap) */}
            <StatCard
                title="Termômetro de Lucro (Últimas 12 Semanas)"
                icon={Flame}
                accent="orange"
            >
                <div className="mt-4 relative z-10 flex flex-col gap-4">
                    <div className="flex flex-wrap gap-1.5">
                        {heatmapDays.map((day, i) => (
                            <div
                                key={i}
                                title={`${day.dateStr}\nLucro: ${formatBRL(day.profit)}`}
                                className={cn(
                                    "w-4 h-4 sm:w-5 sm:h-5 rounded-[4px] cursor-help transition-all hover:scale-125 hover:z-10 shadow-sm",
                                    getHeatmapColor(day.profit)
                                )}
                            />
                        ))}
                    </div>
                    <div className="bg-orange-50/80 p-3.5 rounded-xl border border-orange-100 text-sm text-gray-700 flex items-start gap-2.5">
                        <Flame className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        <p dangerouslySetInnerHTML={{ __html: heatmapInsight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    </div>
                </div>
            </StatCard>

            {/* Controle de Filtro de Histórico */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode('month')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            viewMode === 'month' 
                            ? 'bg-white text-gray-900 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Por Mês (Dias)
                    </button>
                    <button
                        onClick={() => setViewMode('year')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            viewMode === 'year' 
                            ? 'bg-white text-gray-900 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Por Ano (Meses)
                    </button>
                </div>

                <div className="w-full sm:w-auto">
                    <MonthSelector
                        currentDate={currentDate}
                        onMonthChange={setCurrentDate}
                        viewMode={viewMode}
                    />
                </div>
            </div>

            {/* Histórico em Lista */}
            <Card className="border-gray-100 shadow-sm rounded-2xl">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-indigo-500" />
                            Histórico Detalhado
                        </span>
                        <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">
                            Total: {formatBRL(historyData.totalPeriod)}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                        {visibleList.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 font-medium">
                                Sem registros para exibir neste período.
                            </div>
                        ) : (
                            visibleList.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => setSelectedHistoryItem(item)}
                                    className="flex justify-between items-center p-5 hover:bg-gray-50/50 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg
                                            ${item.intensity > 0.8 ? 'bg-emerald-100 text-emerald-700' : 
                                              item.intensity > 0.4 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}
                                        `}>
                                            {item.key.split('/')[0]} {/* Dia ou Nome do Mês curto */}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{item.label}</p>
                                            <p className="text-xs text-gray-500 font-medium">Faturamento da padaria</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-emerald-600 text-lg">{formatBRL(item.value)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {historyData.list.length > visibleCount && (
                        <div className="p-4 flex justify-center bg-gray-50/50 rounded-b-2xl">
                            <button 
                                onClick={() => setVisibleCount(prev => prev + 10)}
                                className="px-5 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                            >
                                Carregar mais
                            </button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal de Transações Detalhadas */}
            {selectedHistoryItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    Transações de Padaria
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">{selectedHistoryItem.label}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedHistoryItem(null)} 
                                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-0">
                            <div className="divide-y divide-gray-100">
                                {modalTransactions.map(t => (
                                    <div key={t.id} className="p-5 flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                                        <div>
                                            <p className="font-bold text-gray-900">{t.description}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                                    {t.date}
                                                </span>
                                                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md capitalize">
                                                    {t.paymentMethod || t.payment_method || 'Outros'}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="font-black text-emerald-600 text-lg">{formatBRL(t.amount)}</span>
                                    </div>
                                ))}
                                {modalTransactions.length === 0 && (
                                    <div className="p-8 text-center text-gray-500 font-medium">
                                        Nenhuma transação encontrada.
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center">
                            <span className="font-bold text-gray-600">Total do período</span>
                            <span className="font-black text-emerald-600 text-xl">{formatBRL(selectedHistoryItem.value)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
