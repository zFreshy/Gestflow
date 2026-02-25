import React, { useState, useMemo } from 'react';
import { ArrowDown, ArrowUp, DollarSign } from 'lucide-react';
import { DashboardTemplate } from '../templates/DashboardTemplate';
import { StatCard } from '../molecules/StatCard';
import { TransactionForm } from '../organisms/TransactionForm';
import { TransactionList } from '../organisms/TransactionList';
import { FinancesChart } from '../organisms/FinancesChart';

const MOCK_DATA = [
    { id: '1', description: 'Venda de Produto', amount: 1250.00, type: 'income', paymentMethod: 'pix', date: new Date(Date.now() - 86400000 * 2).toLocaleDateString('pt-BR'), timestamp: Date.now() - 86400000 * 2 },
    { id: '2', description: 'Pagamento de Energia', amount: 350.00, type: 'expense', paymentMethod: 'cartao', date: new Date(Date.now() - 86400000 * 1).toLocaleDateString('pt-BR'), timestamp: Date.now() - 86400000 * 1 },
];

export function Dashboard() {
    const [transactions, setTransactions] = useState(MOCK_DATA);

    const handleAddTransaction = (newTransaction) => {
        setTransactions((prev) => [...prev, newTransaction]);
    };

    const { totalIncomes, totalExpenses, balance } = useMemo(() => {
        return transactions.reduce(
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
    }, [transactions]);

    const formatCurrency = (val) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <DashboardTemplate
            statsSection={
                <>
                    <StatCard
                        title="Ganhos (Entradas)"
                        value={formatCurrency(totalIncomes)}
                        icon={ArrowUp}
                        description="Total acumulado"
                    />
                    <StatCard
                        title="Gastos (Saídas)"
                        value={formatCurrency(totalExpenses)}
                        icon={ArrowDown}
                        description="Total gasto"
                    />
                    <StatCard
                        title="Saldo Atual"
                        value={formatCurrency(balance)}
                        icon={DollarSign}
                        description="Disponível em caixa"
                    />
                </>
            }
            formSection={<TransactionForm onAddTransaction={handleAddTransaction} />}
            listSection={<TransactionList transactions={transactions} />}
            chartSection={<FinancesChart transactions={transactions} />}
        />
    );
}
