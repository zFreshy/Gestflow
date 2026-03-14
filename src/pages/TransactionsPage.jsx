import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { transactionService } from '../services/transactionService';
import { TransactionItem } from '../components/molecules/TransactionItem';
import { MonthSelector } from '../components/molecules/MonthSelector';
import { Search, Filter, Plus, Calendar } from 'lucide-react-native';

const formatDateISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    if (dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return new Date(year, month - 1, day);
};

export function TransactionsPage({ navigation }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, income, expense
  const [methodFilter, setMethodFilter] = useState('all'); // all, pix, cartao, dinheiro

  // New State for View Mode and Month
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'year'
  const [groupedTransactions, setGroupedTransactions] = useState({});
  const [sortedGroupKeys, setSortedGroupKeys] = useState([]);

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [])
  );

  useEffect(() => {
    processTransactions();
  }, [search, filter, methodFilter, transactions, currentMonth, viewMode]);

  const fetchTransactions = async () => {
    try {
      const data = await transactionService.getAll(user.id);
      
      const mappedData = (data || []).map(t => ({
          ...t,
          expenseType: t.expense_type || t.expenseType,
          paymentMethod: t.payment_method || t.paymentMethod,
          userId: t.user_id || t.userId,
          createdAt: t.created_at || t.createdAt,
          recurrence: t.recurrence,
      }));

      setTransactions(mappedData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const processTransactions = () => {
    let result = transactions;

    if (filter !== 'all') {
      result = result.filter(t => t.type === filter);
    }

    if (methodFilter !== 'all') {
      result = result.filter(t => t.paymentMethod === methodFilter);
    }

    if (search) {
      result = result.filter(t => 
        t.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Filter by Month/Year
    result = result.filter(t => {
        if (!t.date) return false;
        const tDate = parseDate(t.date);
        const sameYear = tDate.getFullYear() === currentMonth.getFullYear();
        if (viewMode === 'year') return sameYear;
        return sameYear && tDate.getMonth() === currentMonth.getMonth();
    });

    // Sort by Date Descending (Newest first)
    result.sort((a, b) => parseDate(b.date) - parseDate(a.date));

    // Grouping
    const groups = result.reduce((acc, t) => {
        const date = parseDate(t.date);
        let key;
        
        if (viewMode === 'year') {
            key = date.getMonth(); // 0-11
        } else {
            key = formatDateISO(date);
        }
        
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
    }, {});

    setGroupedTransactions(groups);

    const sortedKeys = Object.keys(groups).sort((a, b) => {
        if (viewMode === 'year') {
            return parseInt(a) - parseInt(b); // Jan to Dec
        } else {
            return parseDate(b) - parseDate(a); // Newest to Oldest
        }
    });

    setSortedGroupKeys(sortedKeys);
    setFilteredTransactions(result);
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
      <View className="px-6 py-4 bg-white border-b border-gray-100">
        <View className="flex-row justify-between items-center mb-4">
          <View>
              <Text className="text-2xl font-bold text-gray-900">Transações</Text>
              <Text className="text-gray-500 text-xs">Gerencie todos os seus registros</Text>
          </View>
          <TouchableOpacity 
            onPress={() => navigation.navigate('AddTransaction')}
            className="h-10 w-10 bg-[#7E1A8B] rounded-full items-center justify-center shadow-lg shadow-purple-200"
          >
            <Plus color="white" size={24} />
          </TouchableOpacity>
        </View>

        {/* View Mode Toggle */}
        <View className="flex-row bg-gray-100 p-1 rounded-lg mb-4 self-start">
            <TouchableOpacity 
                onPress={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-md ${viewMode === 'month' ? 'bg-white shadow-sm' : ''}`}
            >
                <Text className={`text-xs font-bold ${viewMode === 'month' ? 'text-gray-900' : 'text-gray-500'}`}>Mensal</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                onPress={() => setViewMode('year')}
                className={`px-3 py-1.5 rounded-md ${viewMode === 'year' ? 'bg-white shadow-sm' : ''}`}
            >
                <Text className={`text-xs font-bold ${viewMode === 'year' ? 'text-gray-900' : 'text-gray-500'}`}>Anual</Text>
            </TouchableOpacity>
        </View>

        <MonthSelector currentDate={currentMonth} onMonthChange={setCurrentMonth} viewMode={viewMode} />

        {/* Search */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 h-12 mb-4">
          <Search color="#9CA3AF" size={20} />
          <TextInput
            placeholder="Buscar transações..."
            value={search}
            onChangeText={setSearch}
            className="flex-1 ml-3 text-base text-gray-900"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Filters */}
        <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                <FilterTab label="Todas" value="all" activeValue={filter} onPress={setFilter} />
                <FilterTab label="Entradas" value="income" activeValue={filter} onPress={setFilter} />
                <FilterTab label="Saídas" value="expense" activeValue={filter} onPress={setFilter} />
                <View className="w-4" />
                <FilterTab label="Pix" value="pix" activeValue={methodFilter} onPress={setMethodFilter} />
                <FilterTab label="Cartão" value="cartao" activeValue={methodFilter} onPress={setMethodFilter} />
                <FilterTab label="Dinheiro" value="dinheiro" activeValue={methodFilter} onPress={setMethodFilter} />
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
        >
            {sortedGroupKeys.length === 0 ? (
                <View className="items-center py-8">
                    <Calendar color="#D1D5DB" size={40} />
                    <Text className="text-gray-500 font-medium mt-3">Nenhuma transação encontrada.</Text>
                </View>
            ) : (
                <View className="space-y-6">
                    {sortedGroupKeys.map(key => (
                        <View key={key} className="mb-6">
                            <Text className={`text-sm font-bold mb-3 capitalize ${viewMode === 'year' ? 'text-[#7E1A8B] text-lg' : 'text-gray-500'}`}>
                                {getGroupLabel(key)}
                            </Text>
                            <View className="space-y-3">
                                {groupedTransactions[key].map(item => (
                                    <View key={item.id} className="mb-3">
                                        <TransactionItem 
                                            transaction={item} 
                                            onEdit={() => handleEdit(item)}
                                            onDelete={() => handleDelete(item)}
                                        />
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
