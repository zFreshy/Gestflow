import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/pages/LoginPage';
import { DashboardTemplate } from './components/templates/DashboardTemplate';
import { DashboardPage } from './components/pages/DashboardPage';
import { TransactionsPage } from './components/pages/TransactionsPage';
import { CalendarPage } from './components/pages/CalendarPage';
import { TransactionForm } from './components/organisms/TransactionForm';
import { FixedExpensesPage } from './components/pages/FixedExpensesPage';
import { supabase } from './lib/supabase';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function AppContent() {
  const [transactions, setTransactions] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const location = useLocation();

  // Forcing month 8 (September 2025) as baseline for the demo
  const selectedMonth = 8;

  useEffect(() => {
    if (user) {
      fetchTransactions();
    } else {
      setTransactions([]);
      setLoading(false);
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      const formattedTransactions = data.map(t => {
        // Convert YYYY-MM-DD to DD/MM/YYYY
        const [year, month, day] = t.date.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        
        return {
          ...t,
          paymentMethod: t.payment_method,
          expenseType: t.expense_type,
          clientName: t.client_name,
          isBakeryIncome: t.is_bakery_income,
          healthPlan: t.health_plan,
          date: formattedDate,
          timestamp: new Date(year, month - 1, day).getTime()
        };
      });

      setTransactions(formattedTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (newTransaction) => {
    try {
      // Convert DD/MM/YYYY to YYYY-MM-DD
      const [day, month, year] = newTransaction.date.split('/');
      const formattedDate = `${year}-${month}-${day}`;

      const transactionToSave = {
        description: newTransaction.description,
        amount: newTransaction.amount,
        type: newTransaction.type,
        payment_method: newTransaction.paymentMethod,
        date: formattedDate,
        subtitle: newTransaction.subtitle || newTransaction.clientName || '', // Use clientName if subtitle is empty (fallback)
        client_name: newTransaction.clientName,
        is_bakery_income: newTransaction.isBakeryIncome,
        recurrence: newTransaction.recurrence,
        exam: newTransaction.exam,
        health_plan: newTransaction.healthPlan,
        status: newTransaction.status || 'Aguardando',
        expense_type: newTransaction.expenseType,
        user_id: user.id
      };

      const { data, error } = await supabase
        .from('transactions')
        .insert([transactionToSave])
        .select()
        .single();

      if (error) throw error;

      // Update local state with the returned data formatted
      const savedTransaction = {
        ...data,
        paymentMethod: data.payment_method,
        expenseType: data.expense_type,
        clientName: data.client_name,
        isBakeryIncome: data.is_bakery_income,
        healthPlan: data.health_plan,
        date: newTransaction.date, // Use original date string
        timestamp: newTransaction.timestamp
      };

      setTransactions((prev) => [savedTransaction, ...prev]);
      setIsFormOpen(false);
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Erro ao adicionar transação');
    }
  };

  const handleEditTransaction = async (updatedTransaction) => {
    try {
      // Convert DD/MM/YYYY to YYYY-MM-DD
      const [day, month, year] = updatedTransaction.date.split('/');
      const formattedDate = `${year}-${month}-${day}`;

      const transactionToUpdate = {
        description: updatedTransaction.description,
        amount: updatedTransaction.amount,
        type: updatedTransaction.type,
        payment_method: updatedTransaction.paymentMethod,
        date: formattedDate,
        subtitle: updatedTransaction.subtitle || updatedTransaction.clientName || '',
        client_name: updatedTransaction.clientName,
        is_bakery_income: updatedTransaction.isBakeryIncome,
        recurrence: updatedTransaction.recurrence,
        exam: updatedTransaction.exam,
        health_plan: updatedTransaction.healthPlan,
        status: updatedTransaction.status || 'Aguardando',
        expense_type: updatedTransaction.expenseType,
      };

      const { data, error } = await supabase
        .from('transactions')
        .update(transactionToUpdate)
        .eq('id', updatedTransaction.id)
        .select()
        .single();

      if (error) throw error;

      const savedTransaction = {
        ...data,
        paymentMethod: data.payment_method,
        expenseType: data.expense_type,
        clientName: data.client_name,
        isBakeryIncome: data.is_bakery_income,
        healthPlan: data.health_plan,
        date: updatedTransaction.date,
        timestamp: updatedTransaction.timestamp
      };

      setTransactions(prev => prev.map(t => t.id === savedTransaction.id ? savedTransaction : t));
      setIsFormOpen(false);
      setEditingTransaction(null);
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Erro ao atualizar transação');
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta transação?')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;

      setTransactions(prev => prev.filter(t => t.id !== transactionId));
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Erro ao excluir transação');
    }
  };

  const handleUpdateStatus = async (transactionId, newStatus) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: newStatus })
        .eq('id', transactionId);

      if (error) throw error;

      setTransactions(prev => prev.map(t => 
          t.id === transactionId ? { ...t, status: newStatus } : t
      ));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status');
    }
  };

  const openAddForm = () => {
    setEditingTransaction(null);
    setIsFormOpen(true);
  };

  const openEditForm = (transaction) => {
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  };

  // Determine if header should be hidden based on path
  const hideHeader = location.pathname === '/calendar';

  if (loading && user) {
      return <div className="min-h-screen flex items-center justify-center">Carregando dados...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="*"
        element={
          <PrivateRoute>
            <DashboardTemplate
              selectedMonth={selectedMonth}
              onOpenForm={openAddForm}
              transactions={transactions}
              hideHeader={hideHeader}
            >
              <Routes>
                <Route path="/" element={<DashboardPage transactions={transactions} />} />
                <Route 
                  path="/transactions" 
                  element={
                    <TransactionsPage 
                      transactions={transactions} 
                      onEdit={openEditForm} 
                      onDelete={handleDeleteTransaction} 
                    />
                  } 
                />
                <Route 
                  path="/fixed-expenses" 
                  element={
                    <FixedExpensesPage 
                      transactions={transactions} 
                      onUpdateStatus={handleUpdateStatus} 
                      onEdit={openEditForm} 
                      onDelete={handleDeleteTransaction} 
                    />
                  } 
                />
                <Route 
                  path="/calendar" 
                  element={
                    <CalendarPage 
                      transactions={transactions} 
                      onEdit={openEditForm} 
                      onDelete={handleDeleteTransaction}
                    />
                  } 
                />
                {/* Redirect unknown routes to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>

              <TransactionForm
                onAddTransaction={handleAddTransaction}
                onEditTransaction={handleEditTransaction}
                initialData={editingTransaction}
                isOpen={isFormOpen}
                onClose={() => {
                  setIsFormOpen(false);
                  setTimeout(() => setEditingTransaction(null), 300); // Clear after animation
                }}
              />
            </DashboardTemplate>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
