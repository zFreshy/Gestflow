import React from 'react';
import { ArrowUp, ArrowDown, DollarSign, TrendingUp, Users, Activity, XCircle, Clock, CheckCircle } from 'lucide-react';
import { StatCard } from '../molecules/StatCard';
import { DonutChart } from '../molecules/DonutChart';
import { FinancesChart } from '../organisms/FinancesChart';

export function DashboardPage({ transactions }) {
    const totalCount = transactions.length;
    const incomeCount = transactions.filter(t => t.type === 'income').length;
    const expenseCount = transactions.filter(t => t.type === 'expense').length;

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

                {/* Card 2 — Exames no mês */}
                <StatCard
                    title="Exames no mês"
                    icon={Activity}
                    accent="yellow"
                >
                    <div className="flex items-end justify-between mt-4 h-full pb-2">
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-blue-500" />
                                <span className="text-2xl font-bold text-gray-900">13</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 font-medium">Novos</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-500" />
                                <span className="text-2xl font-bold text-gray-900">5</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 font-medium">Em aprovação</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-emerald-500" />
                                <span className="text-2xl font-bold text-gray-900">42</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 font-medium">Andamento</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-2xl font-bold text-gray-900">23</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 font-medium">Cancelados</p>
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
