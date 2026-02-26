import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DashboardTemplate } from './components/templates/DashboardTemplate';
import { DashboardPage } from './components/pages/DashboardPage';
import { TransactionsPage } from './components/pages/TransactionsPage';
import { CalendarPage } from './components/pages/CalendarPage';
import { TransactionForm } from './components/organisms/TransactionForm';
import { FixedExpensesPage } from './components/pages/FixedExpensesPage';

const MOCK_DATA = [
  { id: '1', description: 'Paula Horrana', amount: 1250.00, type: 'income', paymentMethod: 'pix', date: '15/09/2025', timestamp: new Date(2025, 8, 15, 9, 0).getTime(), subtitle: '020.000.000-88', exam: 'Hemograma Completo', healthPlan: 'Unimed Brasil', status: 'Aguardando' },
  { id: '2', description: 'Willy Leal', amount: 350.00, type: 'expense', paymentMethod: 'cartao', date: '15/09/2025', timestamp: new Date(2025, 8, 15, 10, 0).getTime(), subtitle: '020.000.000-88', exam: 'Exame de Colesterol', healthPlan: 'Amil Saúde', status: 'Aguardando', expenseType: 'fixed' },
  { id: '3', description: 'Jasmine Adams', amount: 2800.00, type: 'income', paymentMethod: 'pix', date: '15/09/2025', timestamp: new Date(2025, 8, 15, 11, 0).getTime(), subtitle: '020.000.000-88', exam: 'Teste de Glicemia', healthPlan: 'Bradesco Saúde', status: 'Liberado' },
  { id: '4', description: 'Michael Brown', amount: 480.00, type: 'expense', paymentMethod: 'dinheiro', date: '15/09/2025', timestamp: new Date(2025, 8, 15, 11, 30).getTime(), subtitle: '020.000.000-88', exam: 'Ultrassonografia', healthPlan: 'SulAmérica Saúde', status: 'Aguardando', expenseType: 'variable' },
  { id: '5', description: 'Sara Davis', amount: 890.00, type: 'income', paymentMethod: 'cartao', date: '21/09/2025', timestamp: new Date(2025, 8, 21, 12, 0).getTime(), subtitle: '020.000.000-88', exam: 'Ressonância Magnética', healthPlan: 'Grupo NotreDame', status: 'Liberado' },
  { id: '6', description: 'Carlos Thomas', amount: 1500.00, type: 'expense', paymentMethod: 'pix', date: '23/09/2025', timestamp: new Date(2025, 8, 23, 12, 30).getTime(), subtitle: '020.000.000-88', exam: 'Tomografia', healthPlan: 'Porto Seguro Saúde', status: 'Cancelado', expenseType: 'fixed' },
  { id: '7', description: 'Emily Lee', amount: 1750.00, type: 'income', paymentMethod: 'pix', date: '25/09/2025', timestamp: new Date(2025, 8, 25, 13, 0).getTime(), subtitle: '020.000.000-88', exam: 'Exame de Sangue Oculto', healthPlan: 'Unimed Paulistana', status: 'Liberado' },
];

export default function App() {
  const [transactions, setTransactions] = useState(MOCK_DATA);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const location = useLocation();

  // Forcing month 8 (September 2025) as baseline for the demo
  const selectedMonth = 8;

  const handleAddTransaction = (newTransaction) => {
    setTransactions((prev) => [...prev, newTransaction]);
    setIsFormOpen(false);
  };

  const handleUpdateStatus = (transactionId, newStatus) => {
    setTransactions(prev => prev.map(t => 
        t.id === transactionId ? { ...t, status: newStatus } : t
    ));
  };

  // Determine if header should be hidden based on path
  const hideHeader = location.pathname === '/calendar';

  return (
    <DashboardTemplate
      selectedMonth={selectedMonth}
      onOpenForm={() => setIsFormOpen(true)}
      transactions={transactions}
      hideHeader={hideHeader}
    >
      <Routes>
        <Route path="/" element={<DashboardPage transactions={transactions} />} />
        <Route path="/transactions" element={<TransactionsPage transactions={transactions} />} />
        <Route path="/fixed-expenses" element={<FixedExpensesPage transactions={transactions} onUpdateStatus={handleUpdateStatus} />} />
        <Route path="/calendar" element={<CalendarPage transactions={transactions} />} />
        {/* Redirect unknown routes to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <TransactionForm
        onAddTransaction={handleAddTransaction}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
      />
    </DashboardTemplate>
  );
}
