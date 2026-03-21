import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/pages/LoginPage';
import { ForgotPasswordPage } from './components/pages/ForgotPasswordPage';
import { UpdatePasswordPage } from './components/pages/UpdatePasswordPage';
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

  // Use current month
  const selectedMonth = new Date().getMonth();

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
          timestamp: new Date(year, month - 1, day).getTime(),
          active: t.active,
          end_date: t.end_date
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
        status: updatedTransaction.status || (updatedTransaction.id ? (transactions.find(t => t.id === updatedTransaction.id)?.status) : 'Aguardando'), // Preserve status if editing
        expense_type: updatedTransaction.expenseType,
        active: updatedTransaction.active,
        end_date: updatedTransaction.end_date // Pass end_date to DB
      };

      // Check if it's a virtual transaction (ID starts with 'virtual-')
      const isVirtual = updatedTransaction.id && updatedTransaction.id.toString().startsWith('virtual-');

      if (isVirtual) {
          // If virtual, we create a NEW transaction instead of updating
          // Remove the virtual ID so supabase generates a new one
          // IMPORTANT: Explicitly add user_id to ensure RLS policies pass
          const { id, ...transactionToCreate } = {
              ...transactionToUpdate,
              user_id: user.id
          };
          
          // Ensure status is meaningful (if user edited it, great, otherwise keep pending or set to whatever makes sense)
          // Usually when editing a virtual expense, we are "realizing" it or just adjusting it before payment.
          // Let's treat it as a new insert.
          
          const { data, error } = await supabase
            .from('transactions')
            .insert([transactionToCreate])
            .select()
            .single();

          if (error) throw error;

          // Propagate finalization or reactivation if fixed expense
          let requiresRefetch = false;
          if (transactionToUpdate.type === 'expense' && transactionToUpdate.expense_type === 'fixed') {
               if (transactionToUpdate.active === false && transactionToUpdate.end_date) {
                   await supabase
                    .from('transactions')
                    .update({ 
                        active: false,
                        end_date: transactionToUpdate.end_date
                    })
                    .eq('user_id', user.id)
                    .eq('description', transactionToUpdate.description)
                    .eq('type', 'expense')
                    .eq('expense_type', 'fixed');
                   requiresRefetch = true;
               } else if (transactionToUpdate.active === true) {
                   // Reactivate series
                   await supabase
                    .from('transactions')
                    .update({ 
                        active: true,
                        end_date: null
                    })
                    .eq('user_id', user.id)
                    .eq('description', transactionToUpdate.description)
                    .eq('type', 'expense')
                    .eq('expense_type', 'fixed');
                   requiresRefetch = true;
               }
          }

           const savedTransaction = {
            ...data,
            paymentMethod: data.payment_method,
            expenseType: data.expense_type,
            clientName: data.client_name,
            isBakeryIncome: data.is_bakery_income,
            healthPlan: data.health_plan,
            date: updatedTransaction.date,
            timestamp: updatedTransaction.timestamp,
            active: data.active,
            end_date: data.end_date
          };

          if (requiresRefetch) {
              await fetchTransactions();
          } else {
              setTransactions((prev) => [savedTransaction, ...prev]);
          }
      } else {
          // Normal update for existing real transactions
          const { data, error } = await supabase
            .from('transactions')
            .update(transactionToUpdate)
            .eq('id', updatedTransaction.id)
            .select()
            .single();

          if (error) throw error;

          // Propagate finalization or reactivation if fixed expense
          let requiresRefetch = false;
          if (transactionToUpdate.type === 'expense' && transactionToUpdate.expense_type === 'fixed') {
               if (transactionToUpdate.active === false && transactionToUpdate.end_date) {
                   await supabase
                    .from('transactions')
                    .update({ 
                        active: false,
                        end_date: transactionToUpdate.end_date
                    })
                    .eq('user_id', user.id)
                    .eq('description', transactionToUpdate.description)
                    .eq('type', 'expense')
                    .eq('expense_type', 'fixed');
                   requiresRefetch = true;
               } else if (transactionToUpdate.active === true) {
                   // Reactivate series
                   await supabase
                    .from('transactions')
                    .update({ 
                        active: true,
                        end_date: null
                    })
                    .eq('user_id', user.id)
                    .eq('description', transactionToUpdate.description)
                    .eq('type', 'expense')
                    .eq('expense_type', 'fixed');
                   requiresRefetch = true;
               }
          }

          const savedTransaction = {
            ...data,
            paymentMethod: data.payment_method,
            expenseType: data.expense_type,
            clientName: data.client_name,
            isBakeryIncome: data.is_bakery_income,
            healthPlan: data.health_plan,
            date: updatedTransaction.date,
            timestamp: updatedTransaction.timestamp,
            active: data.active,
            end_date: data.end_date
          };

          if (requiresRefetch) {
              await fetchTransactions();
          } else {
              setTransactions(prev => prev.map(t => t.id === savedTransaction.id ? savedTransaction : t));
          }
      }
      
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

  const handleUpdateStatus = async (transactionId, newStatus, paymentDate = null, interestAmount = 0) => {
    try {
      const updates = { status: newStatus };
      const transaction = transactions.find(t => t.id === transactionId);
      
      // If paying, we might update date and amount
      if (newStatus === 'Pago') {
          if (paymentDate) {
            // Only update date if NOT a fixed expense
            // Fixed expenses should keep their original due date to maintain recurrence order/history
            if (transaction && transaction.expenseType !== 'fixed') {
                // Convert DD/MM/YYYY to YYYY-MM-DD
                const [day, month, year] = paymentDate.split('/');
                updates.date = `${year}-${month}-${day}`; 
            }
          }

          if (interestAmount > 0) {
             if (transaction) {
                updates.amount = transaction.amount + interestAmount;
                // Add interest_rate field update if needed, similar to mobile
                updates.interest_rate = (interestAmount / transaction.amount) * 100;
             }
          }
      } else if (newStatus === 'Aguardando' && transaction?.expenseType === 'fixed') {
          // If unpaying a fixed expense, ensure we reset interest (optional but good for consistency)
          updates.interest_rate = 0;
          // We don't revert amount here because we don't know the original amount easily without storing it,
          // but usually interest adds to amount. If we want to be perfect, we should subtract interest.
          // For now, just resetting status is what user asked for (date issue).
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;

      // Format returned data
      const [year, month, day] = data.date.split('-');
      const formattedDate = `${day}/${month}/${year}`;

      const updatedTransaction = {
          ...data,
          paymentMethod: data.payment_method,
          expenseType: data.expense_type,
          clientName: data.client_name,
          isBakeryIncome: data.is_bakery_income,
          healthPlan: data.health_plan,
          date: formattedDate,
          timestamp: new Date(year, month - 1, day).getTime()
      };

      setTransactions(prev => prev.map(t => 
          t.id === transactionId ? updatedTransaction : t
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
  const hideHeader = false;

  if (loading && user) {
      return <div className="min-h-screen flex items-center justify-center">Carregando dados...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/update-password" element={<UpdatePasswordPage />} />
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
                      onImportSuccess={fetchTransactions}
                    />
                  } 
                />
                <Route 
                  path="/fixed-expenses" 
                  element={
                    <FixedExpensesPage 
                      transactions={transactions} 
                      onUpdateStatus={handleUpdateStatus} 
                      onAddTransaction={handleAddTransaction}
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
