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
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  
  const { user } = useAuth();
  
  // Utilitário para pegar o email real do localstorage, já que às vezes a sessão do auth desincroniza
  const getEmailFromStorage = () => {
      try {
          if (user?.email) {
              console.log("Email from useAuth:", user.email);
              return user.email;
          }
          
          // Fallback para localStorage
          for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                  const item = localStorage.getItem(key);
                  if (item) {
                      const parsed = JSON.parse(item);
                      if (parsed?.user?.email) {
                          console.log("Email from localStorage:", parsed.user.email);
                          return parsed.user.email;
                      }
                  }
              }
          }
      } catch (e) {
          console.error("Erro ao buscar email do storage", e);
      }
      console.log("No email found, returning empty string");
      return '';
  };
  const location = useLocation();

  // Use current month
  const selectedMonth = new Date().getMonth();

  useEffect(() => {
    if (user) {
      setPage(0);
      setTransactions([]);
      setHasMore(true);
      
      // Se estiver na página de Dashboard (raiz), busca tudo. Senão, busca paginado.
      const isDashboard = location.pathname === '/';
      fetchTransactions(0, true, isDashboard);
    } else {
      setTransactions([]);
      setLoading(false);
    }
  }, [user, location.pathname]);

  const fetchTransactions = async (pageToFetch = page, reset = false, fetchAll = false) => {
    try {
      if (reset) setLoading(true);
      
      let query = supabase
        .from('transactions')
        .select('id, description, amount, type, payment_method, date, subtitle, client_name, is_bakery_income, recurrence, exam, health_plan, status, expense_type, interest_rate, active, end_date, user_email, created_at', { count: 'exact' })
        .order('date', { ascending: false });

      let start = 0;
      let end = 0;

      if (!fetchAll) {
          start = pageToFetch * PAGE_SIZE;
          end = start + PAGE_SIZE - 1;
          query = query.range(start, end);
      }

      const { data, error, count } = await query;

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
          end_date: t.end_date,
          user_email: t.user_email,
          installments: t.installments,
          current_installment: t.current_installment
        };
      });

      if (reset || fetchAll) {
          setTransactions(formattedTransactions);
      } else {
          setTransactions(prev => [...prev, ...formattedTransactions]);
      }
      
      if (!fetchAll) {
          setHasMore(start + data.length < count);
      } else {
          setHasMore(false);
      }
      
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTransactions = () => {
      if (!loading && hasMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchTransactions(nextPage);
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
        user_id: user.id,
        user_email: getEmailFromStorage(),
        installments: newTransaction.installments || null
      };

      console.log("Saving transaction with email:", transactionToSave.user_email);

      // Handle Planned Expenses logic
      if (newTransaction.expenseType === 'planned' && newTransaction.plannedEntries) {
          const transactionsToInsert = newTransaction.plannedEntries.map((entry, index) => {
              const [year, month, day] = entry.dateStr.split('-');
              const formattedDate = `${year}-${month}-${day}`;
              
              return {
                  description: newTransaction.description,
                  amount: parseFloat(entry.amount),
                  type: 'expense',
                  payment_method: newTransaction.paymentMethod,
                  date: formattedDate,
                  status: newTransaction.status || 'Aguardando',
                  expense_type: 'variable', // Save as variable to avoid DB constraint issues
                  subtitle: newTransaction.subtitle || 'Despesa Planejada',
                  user_id: user.id,
                  user_email: getEmailFromStorage(),
              };
          });

          const { data, error } = await supabase
            .from('transactions')
            .insert(transactionsToInsert)
            .select();

          if (error) throw error;

          // Recarregar a lista toda, pois adicionamos várias
          await fetchTransactions(0, true);
          setIsFormOpen(false);
          return;
      }

      // Handle Installments logic
      if (transactionToSave.installments && transactionToSave.installments > 1) {
          const installmentCount = transactionToSave.installments;
          const installmentAmount = Number((transactionToSave.amount / installmentCount).toFixed(2));
          
          // Ajustar diferença de arredondamento na última parcela
          const totalCalculated = installmentAmount * (installmentCount - 1);
          const lastInstallmentAmount = Number((transactionToSave.amount - totalCalculated).toFixed(2));

          const transactionsToInsert = [];
          const [year, month, day] = transactionToSave.date.split('-');
          let currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

          for (let i = 1; i <= installmentCount; i++) {
              const currentAmount = i === installmentCount ? lastInstallmentAmount : installmentAmount;
              
              // Adicionar meses (recorrência mensal padrão para parcelamento)
              const installDate = new Date(currentDate);
              if (i > 1) {
                  installDate.setMonth(installDate.getMonth() + (i - 1));
              }

              const formattedInstallDate = `${installDate.getFullYear()}-${String(installDate.getMonth() + 1).padStart(2, '0')}-${String(installDate.getDate()).padStart(2, '0')}`;

              transactionsToInsert.push({
                  ...transactionToSave,
                  amount: currentAmount,
                  date: formattedInstallDate,
                  current_installment: i,
                  // Quando é parcelado, a despesa não é "fixa contínua", ela tem fim, mas para seguir o padrão do Gestflow:
                  active: i === installmentCount ? false : true,
                  end_date: formattedInstallDate,
                  recurrence: null // Tira a recorrência infinita para não gerar virtuais duplicadas
              });
          }

          const { data, error } = await supabase
            .from('transactions')
            .insert(transactionsToInsert)
            .select();

          if (error) throw error;

          // Recarregar a lista toda, pois adicionamos várias
          await fetchTransactions(0, true);
          setIsFormOpen(false);
          return;
      }

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
        timestamp: newTransaction.timestamp,
        user_email: data.user_email,
        installments: data.installments,
        current_installment: data.current_installment
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
              user_id: user.id,
              user_email: getEmailFromStorage()
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
            end_date: data.end_date,
            user_email: data.user_email,
            installments: data.installments,
            current_installment: data.current_installment
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
            end_date: data.end_date,
            user_email: data.user_email,
            installments: data.installments,
            current_installment: data.current_installment
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

  const handleBatchDeleteTransactions = async (transactionIds) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', transactionIds);

      if (error) throw error;

      setTransactions(prev => prev.filter(t => !transactionIds.includes(t.id)));
    } catch (error) {
      console.error('Error batch deleting transactions:', error);
      alert('Erro ao excluir transações');
    }
  };

  const handleUpdateStatus = async (transactionId, newStatus, paymentDate = null, interestAmount = 0) => {
    try {
      const updates = { status: newStatus };
      const transaction = transactions.find(t => t.id === transactionId);
      
      // If paying, we might update date and amount
      if (newStatus === 'Pago') {
          if (paymentDate) {
            // Update date regardless of expense type. 
            // Previous logic prevented fixed expenses from updating their date, causing UI confusion.
            // Check if paymentDate is already DD/MM/YYYY or YYYY-MM-DD
            if (paymentDate.includes('/')) {
                const [day, month, year] = paymentDate.split('/');
                updates.date = `${year}-${month}-${day}`; 
            } else {
                updates.date = paymentDate; // Already YYYY-MM-DD
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
          timestamp: new Date(year, month - 1, day).getTime(),
          user_email: data.user_email,
          installments: data.installments,
          current_installment: data.current_installment
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
                <Route 
                  path="/" 
                  element={
                    <DashboardPage 
                      transactions={transactions} 
                      onLoadMore={loadMoreTransactions}
                      hasMore={hasMore}
                      isLoadingMore={loading && page > 0}
                    />
                  } 
                />
                <Route 
                  path="/transactions" 
                  element={
                    <TransactionsPage 
                      transactions={transactions} 
                      onEdit={openEditForm} 
                      onDelete={handleDeleteTransaction}
                      onBatchDelete={handleBatchDeleteTransactions}
                      onImportSuccess={() => fetchTransactions(0, true)}
                      onLoadMore={loadMoreTransactions}
                      hasMore={hasMore}
                      isLoadingMore={loading && page > 0}
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
