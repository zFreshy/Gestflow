import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, DollarSign, TrendingUp, Users, Activity, XCircle, Clock, CheckCircle, FileText } from 'lucide-react';
import { DashboardTemplate } from '../templates/DashboardTemplate';
import { StatCard } from '../molecules/StatCard';
import { DonutChart } from '../molecules/DonutChart';
import { TransactionForm } from '../organisms/TransactionForm';
import { TransactionList } from '../organisms/TransactionList';

const MOCK_DATA = [
    { id: '1', description: 'Paula Horrana', amount: 1250.00, type: 'income', paymentMethod: 'pix', date: '15/09/2025', timestamp: new Date(2025, 8, 15, 9, 0).getTime(), subtitle: '020.000.000-88', exam: 'Hemograma Completo', healthPlan: 'Unimed Brasil', status: 'Aguardando' },
    { id: '2', description: 'Willy Leal', amount: 350.00, type: 'expense', paymentMethod: 'cartao', date: '15/09/2025', timestamp: new Date(2025, 8, 15, 10, 0).getTime(), subtitle: '020.000.000-88', exam: 'Exame de Colesterol', healthPlan: 'Amil Saúde', status: 'Aguardando' },
    { id: '3', description: 'Jasmine Adams', amount: 2800.00, type: 'income', paymentMethod: 'pix', date: '15/09/2025', timestamp: new Date(2025, 8, 15, 11, 0).getTime(), subtitle: '020.000.000-88', exam: 'Teste de Glicemia', healthPlan: 'Bradesco Saúde', status: 'Liberado' },
    { id: '4', description: 'Michael Brown', amount: 480.00, type: 'expense', paymentMethod: 'dinheiro', date: '15/09/2025', timestamp: new Date(2025, 8, 15, 11, 30).getTime(), subtitle: '020.000.000-88', exam: 'Ultrassonografia', healthPlan: 'SulAmérica Saúde', status: 'Aguardando' },
    { id: '5', description: 'Sara Davis', amount: 890.00, type: 'income', paymentMethod: 'cartao', date: '15/09/2025', timestamp: new Date(2025, 8, 15, 12, 0).getTime(), subtitle: '020.000.000-88', exam: 'Ressonância Magnética', healthPlan: 'Grupo NotreDame', status: 'Liberado' },
    { id: '6', description: 'Carlos Thomas', amount: 1500.00, type: 'expense', paymentMethod: 'pix', date: '15/09/2025', timestamp: new Date(2025, 8, 15, 12, 30).getTime(), subtitle: '020.000.000-88', exam: 'Tomografia', healthPlan: 'Porto Seguro Saúde', status: 'Cancelado' },
    { id: '7', description: 'Emily Lee', amount: 1750.00, type: 'income', paymentMethod: 'pix', date: '15/09/2025', timestamp: new Date(2025, 8, 15, 13, 0).getTime(), subtitle: '020.000.000-88', exam: 'Exame de Sangue Oculto', healthPlan: 'Unimed Paulistana', status: 'Liberado' },
];

export function Dashboard() {
    const now = new Date();
    const [transactions, setTransactions] = useState(MOCK_DATA);
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Hardcoding June for demo matching the reference image "Confira sua agenda de Junho"
    const selectedMonth = 5;

    const handleAddTransaction = (newTransaction) => {
        setTransactions((prev) => [...prev, newTransaction]);
    };

    return (
        <DashboardTemplate
            selectedMonth={selectedMonth}
            onOpenForm={() => setIsFormOpen(true)}
            statsSection={
                <>
                    {/* Card 1 — Pacientes (Total) */}
                    <StatCard
                        title="Pacientes"
                        icon={Users}
                        accent="blue"
                    >
                        <div className="flex flex-col items-center justify-center py-2">
                            <span className="text-4xl font-bold tracking-tight text-gray-900">268</span>
                            <p className="text-xs text-muted-foreground mt-1">Total</p>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-4 pt-4 border-t border-gray-100">
                            <span className="text-emerald-500 font-medium">+12 clientes novos</span>
                            <span className="text-emerald-500 font-medium flex items-center gap-0.5"><TrendingUp className="h-3 w-3" /> 43%</span>
                        </div>
                    </StatCard>

                    {/* Card 2 — Exames no mês (Multi-stat) */}
                    <StatCard
                        title="Exames no mês"
                        icon={Activity}
                        accent="yellow"
                    >
                        <div className="flex items-end justify-between mt-4">
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-blue-500" />
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
                            {/* We will update the DonutChart logic next to match the reference */}
                            <DonutChart transactions={transactions} />
                        </div>
                    </StatCard>
                </>
            }
            formSection={
                <TransactionForm
                    onAddTransaction={handleAddTransaction}
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                />
            }
            listSection={<TransactionList transactions={transactions} />}
        />
    );
}
