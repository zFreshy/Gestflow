import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { transactionService } from '../services/transactionService';
import { TransactionItem } from '../components/molecules/TransactionItem';
import { Search, Filter, Plus } from 'lucide-react-native';

export function TransactionsPage({ navigation }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, income, expense
  const [methodFilter, setMethodFilter] = useState('all'); // all, pix, cartao, dinheiro

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [search, filter, methodFilter, transactions]);

  const fetchTransactions = async () => {
    try {
      const data = await transactionService.getAll(user.id);
      
      // Map Supabase snake_case to camelCase
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

  const filterTransactions = () => {
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

    setFilteredTransactions(result);
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
          <Text className="text-2xl font-bold text-gray-900">Transações</Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('AddTransaction')}
            className="h-10 w-10 bg-[#7E1A8B] rounded-full items-center justify-center shadow-lg shadow-purple-200"
          >
            <Plus color="white" size={24} />
          </TouchableOpacity>
        </View>

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
        <FlatList
          data={filteredTransactions}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <TransactionItem transaction={item} />}
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Filter size={48} color="#E5E7EB" />
              <Text className="text-gray-400 mt-4">Nenhuma transação encontrada</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}