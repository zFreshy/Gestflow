import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { transactionService } from '../services/transactionService';
import { TransactionItem } from '../components/molecules/TransactionItem';
import { MonthSelector } from '../components/molecules/MonthSelector';
import { Search, Filter, Plus, Calendar } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PaymentModal } from '../components/organisms/PaymentModal';

// Helper Functions
const isPaid = (status) => ['Pago', 'Liberado', 'pago', 'liberado'].includes(status);

const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    if (typeof dateStr !== 'string') return new Date(dateStr);

    // Handle ISO format (YYYY-MM-DD) which real transactions use
    if (dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // Handle DD/MM/YYYY format
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return new Date(dateStr);
};

const formatDateISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export function FixedExpensesPage({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, paid, pending
  
  // New State for View Mode and Month
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'year'
  const [groupedExpenses, setGroupedExpenses] = useState({});
  const [sortedGroupKeys, setSortedGroupKeys] = useState([]);
  
  // Payment Modal State
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  
  // Data states
  const [allTransactions, setAllTransactions] = useState([]);

  const handleTransactionPress = async (transaction) => {
      // Toggle logic
      const isTransactionPaid = isPaid(transaction.status);
      
      if (isTransactionPaid && !transaction.isVirtual) {
          // Unpay (Mark as Pending)
          try {
              setLoading(true);
              await transactionService.update(transaction.id, {
                  status: 'Aguardando',
                  interest_rate: 0
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
      navigation.navigate('AddTransaction', { transaction });
  };

  const handleDelete = async (transaction) => {
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
              const newTransaction = {
                  description: selectedTransaction.description,
                  amount: selectedTransaction.amount + (interest || 0),
                  type: 'expense',
                  expense_type: 'fixed',
                  payment_method: selectedTransaction.paymentMethod,
                  date: selectedTransaction.date,
                  user_id: user.id,
                  recurrence: selectedTransaction.recurrence,
                  status: 'Pago',
                  active: true,
                  interest_rate: interest ? ((interest / selectedTransaction.amount) * 100) : 0
              };
              
              await transactionService.create(newTransaction);
          } else {
              const updates = {
                  status: 'Pago',
              };
              
              if (interest > 0) {
                  updates.amount = selectedTransaction.amount + interest;
                  updates.interest_rate = (interest / selectedTransaction.amount) * 100;
              }
              
              await transactionService.update(selectedTransaction.id, updates);
          }
          
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
      const response = await transactionService.getAll(user.id, 0, 50, true);
      
      let dataToMap = [];
      if (Array.isArray(response)) {
          dataToMap = response;
      } else if (response && Array.isArray(response.data)) {
          dataToMap = response.data;
      }
      
      // Map and filter ONLY fixed expenses
      const mappedData = dataToMap
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
  }, [allTransactions, search, statusFilter, currentMonth, viewMode]);

  const processTransactions = () => {
      // 1. Base Fixed Expenses
      const baseFixedExpenses = allTransactions;

      // 2. Generate Projections (Virtual Expenses)
      const recurringGroups = {};
      const lookbackDate = new Date();
      lookbackDate.setFullYear(lookbackDate.getFullYear() - 2); // 2 years ago

      baseFixedExpenses.forEach(t => {
          if (t.recurrence) {
              const key = `${t.description}-${t.recurrence}`;
              if (!recurringGroups[key] || parseDate(recurringGroups[key].date) < parseDate(t.date)) {
                  recurringGroups[key] = t;
              }
          }
      });

      const virtualExpenses = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const addRecurrence = (date, recurrence) => {
          const newDate = new Date(date);
          switch (recurrence?.toLowerCase()) {
              case 'daily': newDate.setDate(newDate.getDate() + 1); break;
              case 'weekly': newDate.setDate(newDate.getDate() + 7); break;
              case 'monthly': newDate.setMonth(newDate.getMonth() + 1); break;
              case 'quarterly': newDate.setMonth(newDate.getMonth() + 3); break;
              case 'semiannual': newDate.setMonth(newDate.getMonth() + 6); break;
              case 'annual': newDate.setFullYear(newDate.getFullYear() + 1); break;
              case 'biennial': newDate.setFullYear(newDate.getFullYear() + 2); break;
              default: newDate.setMonth(newDate.getMonth() + 1);
          }
          return newDate;
      };

      Object.values(recurringGroups).forEach(lastExpense => {
          let currentDate = parseDate(lastExpense.date);
          let safetyCounter = 0;
          const maxIterations = 500; 
  
          while (safetyCounter < maxIterations) {
              safetyCounter++;
              const nextDate = addRecurrence(currentDate, lastExpense.recurrence);
              
              if (lastExpense.active === false) {
                 if (!lastExpense.end_date) break; 
                 
                 let endDateObj;
                 if (lastExpense.end_date.includes('/')) {
                     endDateObj = parseDate(lastExpense.end_date);
                 } else {
                      const [y, m, d] = lastExpense.end_date.split('-');
                      endDateObj = new Date(y, m - 1, d);
                 }
                 
                 if (nextDate > endDateObj) break;
             }
 
             currentDate = nextDate;
             const nextDateStr = formatDateISO(nextDate);
             const exists = baseFixedExpenses.some(t => 
                 t.description === lastExpense.description &&
                 t.amount === lastExpense.amount &&
                 t.date === nextDateStr
             );

             if (!exists) {
                 const virtualExpense = {
                     ...lastExpense,
                     id: `virtual-${lastExpense.id}-${nextDate.getTime()}`,
                     date: nextDateStr, 
                     status: 'Aguardando',
                     isVirtual: true,
                     isOverdue: nextDate < today
                 };
                 virtualExpenses.push(virtualExpense);
             }
  
              if (nextDate >= today) break;
          }
      });

      // 3. Combine Real + Virtual
      let allCandidates = [...baseFixedExpenses, ...virtualExpenses];

      // Filter out cancelled
      allCandidates = allCandidates.filter(t => {
          if (t.active === false && t.end_date) {
              const tDate = parseDate(t.date);
              const endDate = parseDate(t.end_date);
              tDate.setHours(0,0,0,0);
              endDate.setHours(0,0,0,0);
              if (tDate > endDate) return false;
          }
          return true;
      });

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

      // 5. Filter by Month/Year and Group
      let filtered = allCandidates.filter(t => {
          const tDate = parseDate(t.date);
          const sameYear = tDate.getFullYear() === currentMonth.getFullYear();
          if (viewMode === 'year') return sameYear;
          return sameYear && tDate.getMonth() === currentMonth.getMonth();
      });

      // Sort by Date
      filtered.sort((a, b) => parseDate(a.date) - parseDate(b.date));

      // Grouping
      const groups = filtered.reduce((acc, expense) => {
          const date = parseDate(expense.date);
          let key;
          
          if (viewMode === 'year') {
              key = date.getMonth(); // 0-11
          } else {
              key = formatDateISO(date);
          }
          
          if (!acc[key]) acc[key] = [];
          acc[key].push(expense);
          return acc;
      }, {});

      setGroupedExpenses(groups);
      
      const sortedKeys = Object.keys(groups).sort((a, b) => {
          if (viewMode === 'year') {
              return parseInt(a) - parseInt(b);
          } else {
              return parseDate(a) - parseDate(b);
          }
      });
      
      setSortedGroupKeys(sortedKeys);
  };

  const getGroupLabel = (key) => {
      if (viewMode === 'year') {
          const MONTHS = [
              'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
          ];
          return MONTHS[parseInt(key)];
      } else {
          const date = parseDate(key);
          const today = new Date();
          today.setHours(0,0,0,0);
          
          if (date.getTime() === today.getTime()) return 'Hoje';
          
          return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      }
  };

  const calculateGroupTotal = (transactions) => {
      return transactions.reduce((acc, t) => {
          const amount = parseFloat(t.amount || 0);
          // For Fixed Expenses, usually they are expenses (-), but sometimes logic might differ.
          // Assuming all are expenses unless specified.
          if (t.type === 'income') {
              return acc + amount;
          } else {
              return acc - amount;
          }
      }, 0);
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
      
      <View className="px-6 pt-6 pb-4 bg-white border-b border-gray-100 rounded-b-3xl shadow-sm z-10">
        <View className="flex-row justify-between items-start mb-6">
          <View>
             <Text className="text-3xl font-extrabold text-gray-900 tracking-tight">Despesas Fixas</Text>
             <Text className="text-gray-500 text-sm mt-1">Gerencie suas contas recorrentes</Text>
          </View>
          <TouchableOpacity 
            onPress={() => navigation.navigate('AddTransaction', { initialType: 'expense', initialExpenseType: 'fixed' })}
            className="h-12 w-12 bg-[#7E1A8B] rounded-2xl items-center justify-center shadow-lg shadow-purple-200 active:scale-95 transition-transform"
          >
            <Plus color="white" size={24} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* View Mode Toggle */}
        <View className="flex-row bg-gray-100 p-1.5 rounded-xl mb-6 self-start">
            <TouchableOpacity 
                onPress={() => setViewMode('month')}
                className={`px-4 py-2 rounded-lg ${viewMode === 'month' ? 'bg-white shadow-sm' : ''}`}
            >
                <Text className={`text-xs font-bold ${viewMode === 'month' ? 'text-gray-900' : 'text-gray-500'}`}>Mensal</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                onPress={() => setViewMode('year')}
                className={`px-4 py-2 rounded-lg ${viewMode === 'year' ? 'bg-white shadow-sm' : ''}`}
            >
                <Text className={`text-xs font-bold ${viewMode === 'year' ? 'text-gray-900' : 'text-gray-500'}`}>Anual</Text>
            </TouchableOpacity>
        </View>

        <MonthSelector currentDate={currentMonth} onMonthChange={setCurrentMonth} viewMode={viewMode} />

        {/* Search */}
        <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 h-12 mb-4 mt-2">
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row" contentContainerStyle={{ paddingRight: 20 }}>
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
            showsVerticalScrollIndicator={false}
        >
            {sortedGroupKeys.length === 0 ? (
                <View className="items-center justify-center py-20 opacity-50">
                    <View className="bg-gray-100 p-6 rounded-full mb-4">
                        <Calendar color="#9CA3AF" size={40} />
                    </View>
                    <Text className="text-gray-500 font-bold text-lg mt-2">Nada por aqui</Text>
                    <Text className="text-sm text-gray-400 mt-1 text-center">Nenhuma despesa encontrada para este {viewMode === 'year' ? 'ano' : 'mês'}.</Text>
                </View>
            ) : (
                <View className="space-y-6">
                    {sortedGroupKeys.map(key => {
                        const groupTransactions = groupedExpenses[key];
                        const groupTotal = calculateGroupTotal(groupTransactions);
                        
                        return (
                            <View key={key} className="bg-white rounded-3xl p-5 shadow-sm shadow-gray-200">
                                <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-50">
                                    <Text className="text-lg font-bold text-gray-900 capitalize">
                                        {getGroupLabel(key)}
                                    </Text>
                                    <Text className={`text-base font-bold ${groupTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {groupTotal >= 0 ? '+' : ''}{groupTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </Text>
                                </View>
                                <View>
                                    {groupedExpenses[key].map((item, index) => (
                                        <View key={item.id} className={index < groupedExpenses[key].length - 1 ? "mb-4" : ""}>
                                            <TransactionItem 
                                                transaction={item} 
                                                onPress={() => handleTransactionPress(item)}
                                                onEdit={() => handleEdit(item)}
                                                onDelete={() => handleDelete(item)}
                                            />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
