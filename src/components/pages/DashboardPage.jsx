import React from 'react';
import { ArrowUp, ArrowDown, DollarSign, TrendingUp, Users, Activity, XCircle, Clock, CheckCircle } from 'lucide-react';
import { StatCard } from '../molecules/StatCard';
import { DonutChart } from '../molecules/DonutChart';
import { FinancesChart } from '../organisms/FinancesChart';

export function DashboardPage({ transactions }) {
    const totalCount = transactions.length;
    const incomeCount = transactions.filter(t => t.type === 'income').length;
    const expenseCount = transactions.filter(t => t.type === 'expense').length;

    const fixedExpenses = transactions.filter(t => t.type === 'expense' && t.expenseType === 'fixed');
    const variableExpenses = transactions.filter(t => t.type === 'expense' && t.expenseType === 'variable');

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const fixedTotal = fixedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const variableTotal = variableExpenses.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="space-y-6">
            {/* Stats Row */}
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

            {/* Chart Full Width */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <FinancesChart transactions={transactions} />
            </div>
        </div>
    );
}
