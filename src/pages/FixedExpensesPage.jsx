import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { transactionService } from '../services/transactionService';
import { TransactionItem } from '../components/molecules/TransactionItem';
import { Search, Filter, Plus, Calendar, History } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';

// Helper Functions
const isPaid = (status) => ['Pago', 'Liberado', 'pago', 'liberado'].includes(status);

const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    // Handle ISO format (YYYY-MM-DD) which real transactions use
    if (dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-');
        return new Date(year, month - 1, day);
    }
    // Handle DD/MM/YYYY format
    const [day, month, year] = dateStr.split('/');
    return new Date(year, month - 1, day);
};

const formatDateISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const calculateNextOccurrence = (expense) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expenseDate = parseDate(expense.date);
    
    if (expenseDate >= today) return expenseDate;

    let nextDate = new Date(expenseDate);
    // Safety break to prevent infinite loops if dates are weird
    let loops = 0;
    while (nextDate < today && loops < 1000) {
        loops++;
        switch (expense.recurrence?.toLowerCase()) {
            case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
            case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
            case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
            case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
            case 'semiannual': nextDate.setMonth(nextDate.getMonth() + 6); break;
            case 'annual': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
            case 'biennial': nextDate.setFullYear(nextDate.getFullYear() + 2); break;
            default: nextDate.setMonth(nextDate.getMonth() + 1);
        }
    }
    return nextDate;
};

import { PaymentModal } from '../components/organisms/PaymentModal';

export function FixedExpensesPage({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, paid, pending
  
  // Payment Modal State
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  
  // Data states
  const [upcomingExpenses, setUpcomingExpenses] = useState([]);
  const [pastExpenses, setPastExpenses] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);

  const handleTransactionPress = async (transaction) => {
      // Toggle logic
      const isTransactionPaid = isPaid(transaction.status);
      
      if (isTransactionPaid && !transaction.isVirtual) {
          // Unpay (Mark as Pending)
          try {
              setLoading(true);
              await transactionService.update(transaction.id, {
                  status: 'Aguardando', // or 'Pendente' depending on backend enum, usually 'Aguardando' based on context
                  interestRate: 0 // Use camelCase if DB column is camelCase
              });
              await fetchTransactions();
          } catch (error) {
              console.error(error);
          } finally {
              setLoading(false);
          }
      } else {
          // Open Payment Modal
          setSelectedTransaction(transaction);
          setIsPaymentModalVisible(true);
      }
  };

  const handleEdit = (transaction) => {
      // Navigate to Edit (Reuse AddTransaction with params)
      // We need to implement Edit mode in TransactionForm or separate page
      // For now, let's assume AddTransaction can handle edit if we pass data
      navigation.navigate('AddTransaction', { transaction });
  };

  const handleDelete = async (transaction) => {
      // Confirm delete
      // Using Alert for simplicity
      try {
        setLoading(true);
        await transactionService.delete(transaction.id);
        await fetchTransactions();
      } catch (error) {
          console.error(error);
      } finally {
          setLoading(false);
      }
  };

  const handleConfirmPayment = async (id, status, date, interest) => {
      try {
          setLoading(true);
          
          if (selectedTransaction.isVirtual) {
              // Create new transaction for virtual expense
              const newTransaction = {
                  description: selectedTransaction.description,
                  amount: selectedTransaction.amount + (interest || 0),
                  type: 'expense',
                  expense_type: 'fixed', // Use snake_case
                  payment_method: selectedTransaction.paymentMethod, // Use snake_case
                  date: selectedTransaction.date, // Use ORIGINAL DUE DATE to maintain recurrence logic
                  timestamp: new Date(selectedTransaction.date).getTime(),
                  user_id: user.id,
                  recurrence: selectedTransaction.recurrence,
                  status: 'Pago',
                  interestRate: interest ? ((interest / selectedTransaction.amount) * 100) : 0 // Use camelCase
              };
              
              await transactionService.create(newTransaction);
          } else {
              // Update existing transaction
              const updates = {
                  status: 'Pago',
                  // Do NOT update date/timestamp to preserve original due date
                  // date: date, 
                  // timestamp: new Date(date).getTime(),
              };
              
              if (interest > 0) {
                  updates.amount = selectedTransaction.amount + interest;
                  updates.interestRate = (interest / selectedTransaction.amount) * 100; // Use camelCase
              }
              
              await transactionService.update(selectedTransaction.id, updates);
          }
          
          // Refresh list
          await fetchTransactions();
          
      } catch (error) {
          console.error("Error processing payment:", error);
          alert("Erro ao processar pagamento");
      } finally {
          setLoading(false);
          setIsPaymentModalVisible(false);
          setSelectedTransaction(null);
      }
  };

  const fetchTransactions = async () => {
    try {
      const data = await transactionService.getAll(user.id);
      
      // Map and filter ONLY fixed expenses
      const mappedData = (data || [])
        .map(t => ({
            ...t,
            expenseType: t.expense_type || t.expenseType,
            paymentMethod: t.payment_method || t.paymentMethod,
            userId: t.user_id || t.userId,
            createdAt: t.created_at || t.createdAt,
            recurrence: t.recurrence,
        }))
        .filter(t => t.type === 'expense' && t.expenseType === 'fixed');

      setAllTransactions(mappedData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [])
  );

  const onRefresh = () => {
      setRefreshing(true);
      fetchTransactions();
  };

  // Process transactions whenever data or filters change
  useEffect(() => {
    processTransactions();
  }, [allTransactions, search, statusFilter]);

  const processTransactions = () => {
      // 1. Base Fixed Expenses
      const baseFixedExpenses = allTransactions;

      // 2. Generate Projections (Virtual Expenses)
      const recurringGroups = {};
      baseFixedExpenses.forEach(t => {
          if (t.recurrence) {
              const key = `${t.description}-${t.amount}-${t.recurrence}`;
              // Track the latest occurrence
              if (!recurringGroups[key] || parseDate(recurringGroups[key].date) < parseDate(t.date)) {
                  recurringGroups[key] = t;
              }
          }
      });

      const virtualExpenses = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      Object.values(recurringGroups).forEach(lastExpense => {
          // If the expense is marked as inactive/finished, do not project future occurrences
          if (lastExpense.active === false) return;

          const lastDate = parseDate(lastExpense.date);
          
          // If the last expense is in the future/today and unpaid, it's already in the list.
          if (lastDate >= today && !isPaid(lastExpense.status)) return;

          // Calculate next due date
          const nextDate = calculateNextOccurrence(lastExpense);
          
          // Create virtual expense
          const virtualExpense = {
              ...lastExpense,
              id: `virtual-${lastExpense.id}-${nextDate.getTime()}`,
              date: formatDateISO(nextDate), // Use ISO format (YYYY-MM-DD) to be compatible with formatDate util
              status: 'Aguardando',
              isVirtual: true,
              isOverdue: false // Virtual is strictly future/prediction here? Wait, calculateNextOccurrence returns >= today.
          };
          
          virtualExpenses.push(virtualExpense);
      });

      // 3. Combine Real + Virtual
      let allCandidates = [...baseFixedExpenses, ...virtualExpenses];

      // 4. Apply Filters (Search & Status)
      if (search) {
          const lowerTerm = search.toLowerCase();
          allCandidates = allCandidates.filter(t => t.description.toLowerCase().includes(lowerTerm));
      }

      if (statusFilter !== 'all') {
          if (statusFilter === 'paid') {
              allCandidates = allCandidates.filter(t => isPaid(t.status));
          } else if (statusFilter === 'pending') {
              allCandidates = allCandidates.filter(t => !isPaid(t.status));
          }
      }

      // 5. Split into Upcoming vs Past
      const upcoming = [];
      const past = [];

      allCandidates.forEach(t => {
          const tDate = parseDate(t.date);
          const paid = isPaid(t.status);
          
          // Mark overdue for display logic
          // Overdue if: Not Paid AND Date < Today
          // Note: Virtual expenses are by definition >= today (from calculateNextOccurrence), so they are never overdue.
          // Real expenses can be overdue.
          const overdue = !paid && tDate < today;
          t.isOverdue = overdue;

          // Logic for splitting:
          // Upcoming: Future dates (>= today) AND Not Paid
          // Past: Past dates (< today) OR Paid items
          
          if (tDate < today || paid) {
              past.push(t);
          } else {
              upcoming.push(t);
          }
      });

      // 6. Sort Upcoming (Ascending Date: Today -> Future)
      upcoming.sort((a, b) => parseDate(a.date) - parseDate(b.date));

      // 7. Sort Past (Unpaid First, Then Descending Date)
      past.sort((a, b) => {
          const paidA = isPaid(a.status);
          const paidB = isPaid(b.status);

          if (paidA !== paidB) {
              return paidA ? 1 : -1; // Unpaid first
          }
          return parseDate(b.date) - parseDate(a.date); // Descending date
      });

      setUpcomingExpenses(upcoming);
      setPastExpenses(past);
  };

  const FilterTab = ({ label, value, activeValue, onPress }) => (
    <TouchableOpacity
      onPress={() => onPress(activeValue === value ? 'all' : value)}
      className={`px-4 py-2 rounded-full mr-2 border ${
        activeValue === value 
          ? 'bg-[#7E1A8B] border-[#7E1A8B]' 
          : 'bg-white border-gray-200'
      }`}
    >
      <Text className={activeValue === value ? 'text-white font-medium' : 'text-gray-600'}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <PaymentModal 
          isVisible={isPaymentModalVisible}
          transaction={selectedTransaction}
          onClose={() => setIsPaymentModalVisible(false)}
          onConfirm={handleConfirmPayment}
      />
      
      <View className="px-6 py-4 bg-white border-b border-gray-100">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold text-gray-900">Despesas Fixas</Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('AddTransaction', { initialType: 'expense', initialExpenseType: 'fixed' })}
            className="h-10 w-10 bg-[#7E1A8B] rounded-full items-center justify-center shadow-lg shadow-purple-200"
          >
            <Plus color="white" size={24} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 h-12 mb-4">
          <Search color="#9CA3AF" size={20} />
          <TextInput
            placeholder="Buscar despesas..."
            value={search}
            onChangeText={setSearch}
            className="flex-1 ml-3 text-base text-gray-900"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Filters */}
        <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                <FilterTab label="Todas" value="all" activeValue={statusFilter} onPress={setStatusFilter} />
                <FilterTab label="Pagas" value="paid" activeValue={statusFilter} onPress={setStatusFilter} />
                <FilterTab label="Pendentes" value="pending" activeValue={statusFilter} onPress={setStatusFilter} />
            </ScrollView>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#7E1A8B" />
        </View>
      ) : (
        <ScrollView 
            contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Section 1: Upcoming */}
            <View className="mb-8">
                <View className="flex-row items-center mb-4 border-l-4 border-amber-400 pl-3">
                    <Calendar color="#B45309" size={20} />
                    <Text className="ml-2 text-lg font-bold text-amber-700">Despesas por Vir</Text>
                </View>
                
                {upcomingExpenses.length === 0 ? (
                    <Text className="text-gray-400 text-center py-4">Nenhuma despesa para os próximos dias.</Text>
                ) : (
                    upcomingExpenses.map(item => (
                        <TouchableOpacity 
                            key={item.id} 
                            onPress={() => handleTransactionPress(item)}
                        >
                            <TransactionItem 
                                transaction={item} 
                                onEdit={() => handleEdit(item)}
                                onDelete={() => handleDelete(item)}
                            />
                        </TouchableOpacity>
                    ))
                )}
            </View>

            {/* Section 2: Past */}
            <View>
                <View className="flex-row items-center mb-4 pl-3">
                    <History color="#374151" size={20} />
                    <Text className="ml-2 text-lg font-bold text-gray-700">Despesas Anteriores</Text>
                </View>

                {pastExpenses.length === 0 ? (
                    <Text className="text-gray-400 text-center py-4">Nenhuma despesa anterior encontrada.</Text>
                ) : (
                    pastExpenses.map(item => (
                        <TouchableOpacity 
                            key={item.id} 
                            onPress={() => handleTransactionPress(item)}
                        >
                            <TransactionItem 
                                transaction={item} 
                                onEdit={() => handleEdit(item)}
                                onDelete={() => handleDelete(item)}
                            />
                        </TouchableOpacity>
                    ))
                )}
            </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
