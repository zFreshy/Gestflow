import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, DollarSign, TrendingUp, Users, Activity, XCircle, Clock, CheckCircle } from 'lucide-react';
import { DashboardTemplate } from '../templates/DashboardTemplate';
import { StatCard } from '../molecules/StatCard';
import { DonutChart } from '../molecules/DonutChart';
import { TransactionForm } from '../organisms/TransactionForm';
import { TransactionList } from '../organisms/TransactionList';
import { FinancesChart } from '../organisms/FinancesChart';

const MOCK_DATA = [
    { id: '1', description: 'Venda de Produto', amount: 1250.00, type: 'income', paymentMethod: 'pix', date: '15/02/2026', timestamp: new Date(2026, 1, 15, 9, 0).getTime() },
    { id: '2', description: 'Pagamento de Energia', amount: 350.00, type: 'expense', paymentMethod: 'cartao', date: '14/02/2026', timestamp: new Date(2026, 1, 14, 10, 0).getTime() },
    { id: '3', description: 'Serviço de Consultoria', amount: 2800.00, type: 'income', paymentMethod: 'pix', date: '12/02/2026', timestamp: new Date(2026, 1, 12, 11, 0).getTime() },
    { id: '4', description: 'Compra de Material', amount: 480.00, type: 'expense', paymentMethod: 'dinheiro', date: '10/02/2026', timestamp: new Date(2026, 1, 10, 14, 0).getTime() },
    { id: '5', description: 'Venda Online', amount: 890.00, type: 'income', paymentMethod: 'cartao', date: '08/02/2026', timestamp: new Date(2026, 1, 8, 16, 0).getTime() },
    { id: '6', description: 'Pagamento de Aluguel', amount: 1500.00, type: 'expense', paymentMethod: 'pix', date: '05/02/2026', timestamp: new Date(2026, 1, 5, 8, 0).getTime() },
    { id: '7', description: 'Freelance Design', amount: 1750.00, type: 'income', paymentMethod: 'pix', date: '03/02/2026', timestamp: new Date(2026, 1, 3, 9, 30).getTime() },
    { id: '8', description: 'Internet e Telefone', amount: 220.00, type: 'expense', paymentMethod: 'cartao', date: '01/02/2026', timestamp: new Date(2026, 1, 1, 10, 0).getTime() },
    { id: '9', description: 'Venda de Serviço', amount: 3200.00, type: 'income', paymentMethod: 'dinheiro', date: '20/01/2026', timestamp: new Date(2026, 0, 20, 15, 0).getTime() },
    { id: '10', description: 'Manutenção Equipamentos', amount: 650.00, type: 'expense', paymentMethod: 'pix', date: '18/01/2026', timestamp: new Date(2026, 0, 18, 11, 0).getTime() },
    { id: '11', description: 'Comissão de Vendas', amount: 420.00, type: 'income', paymentMethod: 'cartao', date: '15/01/2026', timestamp: new Date(2026, 0, 15, 14, 0).getTime() },
    { id: '12', description: 'Material de Escritório', amount: 180.00, type: 'expense', paymentMethod: 'dinheiro', date: '10/01/2026', timestamp: new Date(2026, 0, 10, 9, 0).getTime() },
];

export function Dashboard() {
    const now = new Date();
    const [transactions, setTransactions] = useState(MOCK_DATA);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    const handleAddTransaction = (newTransaction) => {
        setTransactions((prev) => [...prev, newTransaction]);
    };

    // Filter by selected month
    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            const [day, month, year] = t.date.split('/').map(Number);
            return (month - 1) === selectedMonth && year === selectedYear;
        });
    }, [transactions, selectedMonth, selectedYear]);

    const { totalIncomes, totalExpenses, balance } = useMemo(() => {
        return filteredTransactions.reduce(
            (acc, curr) => {
                if (curr.type === 'income') {
                    acc.totalIncomes += curr.amount;
                } else {
                    acc.totalExpenses += curr.amount;
                }
                acc.balance = acc.totalIncomes - acc.totalExpenses;
                return acc;
            },
            { totalIncomes: 0, totalExpenses: 0, balance: 0 }
        );
    }, [filteredTransactions]);

    const formatCurrency = (val) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const totalCount = filteredTransactions.length;
    const incomeCount = filteredTransactions.filter(t => t.type === 'income').length;
    const expenseCount = filteredTransactions.filter(t => t.type === 'expense').length;

    return (
        <DashboardTemplate
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
            onOpenForm={() => setIsFormOpen(true)}
            statsSection={
                <>
                    {/* Card 1 — Total like "Pacientes" in reference */}
                    <StatCard
                        title="Saldo do Mês"
                        icon={DollarSign}
                        accent={balance >= 0 ? 'blue' : 'red'}
                        value={formatCurrency(balance)}
                        description="Disponível em caixa"
                        extra={
                            <div className="flex items-center gap-4 text-xs">
                                <span className="text-emerald-500 flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    +{incomeCount} entradas
                                </span>
                                <span className="text-red-400 flex items-center gap-1">
                                    {expenseCount} saídas
                                </span>
                            </div>
                        }
                    />

                    {/* Card 2 — Multi-stat like "Exames no mês" in reference */}
                    <StatCard
                        title="Movimentações no Mês"
                        icon={Activity}
                        accent="green"
                    >
                        <div className="flex items-end gap-5 mt-2">
                            <div className="text-center">
                                <div className="flex items-center gap-1.5 justify-center">
                                    <ArrowUp className="h-4 w-4 text-emerald-500" />
                                    <span className="text-2xl font-bold">{incomeCount}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">Entradas</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center gap-1.5 justify-center">
                                    <ArrowDown className="h-4 w-4 text-red-500" />
                                    <span className="text-2xl font-bold">{expenseCount}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">Saídas</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center gap-1.5 justify-center">
                                    <CheckCircle className="h-4 w-4 text-blue-500" />
                                    <span className="text-2xl font-bold">{totalCount}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">Total</p>
                            </div>
                        </div>
                    </StatCard>

                    {/* Card 3 — Donut chart like "Exames por Convênios" in reference */}
                    <StatCard
                        title="Transações por Método"
                        icon={Users}
                        accent="purple"
                    >
                        <div className="mt-2">
                            <DonutChart transactions={filteredTransactions} />
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
            listSection={<TransactionList transactions={filteredTransactions} />}
            chartSection={<FinancesChart transactions={filteredTransactions} />}
        />
    );
}
