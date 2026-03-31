import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { transactionService } from '../services/transactionService';
import { TransactionItem } from '../components/molecules/TransactionItem';
import { MonthSelector } from '../components/molecules/MonthSelector';
import { Search, Filter, Plus, Calendar, Upload, Trash2, ListChecks } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

const formatDateISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    if (typeof dateStr !== 'string') return new Date(dateStr);

    if (dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return new Date(dateStr);
};

export function TransactionsPage({ navigation }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, income, expense
  const [methodFilter, setMethodFilter] = useState('all'); // all, pix, cartao, dinheiro

  // New State for View Mode and Month
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'year'
  const [groupedTransactions, setGroupedTransactions] = useState({});
  const [sortedGroupKeys, setSortedGroupKeys] = useState([]);
  
  // Batch delete state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setPage(0);
      setHasMore(true);
      fetchTransactions(0, true);
    }, [])
  );

  useEffect(() => {
    processTransactions();
  }, [search, filter, methodFilter, transactions, currentMonth, viewMode]);

  const fetchTransactions = async (pageToFetch = page, reset = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await transactionService.getAll(user.id, pageToFetch);
      const data = response.data || [];
      
      const mappedData = data.map(t => ({
          ...t,
          expenseType: t.expense_type || t.expenseType,
          paymentMethod: t.payment_method || t.paymentMethod,
          userId: t.user_id || t.userId,
          createdAt: t.created_at || t.createdAt,
          recurrence: t.recurrence,
      }));

      if (reset) {
        setTransactions(mappedData);
      } else {
        setTransactions(prev => [...prev, ...mappedData]);
      }
      
      setHasMore(response.hasMore);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchTransactions(nextPage);
    }
  };

  const processTransactions = () => {
    let result = transactions;

    if (filter !== 'all') {
      if (filter === 'bakery_income') {
        result = result.filter(t => t.type === 'income' && t.is_bakery_income === true);
      } else {
        result = result.filter(t => t.type === filter);
      }
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
            return parseInt(b) - parseInt(a); // Dec to Jan (Newest first)
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
          
          // Format: "Terça, 14" to match reference style more closely, or keep full date
          // Using a cleaner format: "Terça-feira, 14 de Março"
          return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      }
  };

  const calculateGroupTotal = (transactions) => {
      return transactions.reduce((acc, t) => {
          const amount = parseFloat(t.amount || 0);
          if (t.type === 'income') {
              return acc + amount;
          } else {
              return acc - amount;
          }
      }, 0);
  };

  const handleEdit = (transaction) => {
    navigation.navigate('AddTransaction', { transaction });
  };

  const handleDelete = async (transaction) => {
    try {
      setLoading(true);
      await transactionService.delete(transaction.id);
      setPage(0);
      await fetchTransactions(0, true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const toggleGroupSelection = (key) => {
      const groupTransactions = groupedTransactions[key];
      const groupIds = groupTransactions.map(t => t.id);
      const newSet = new Set(selectedIds);
      
      const allSelected = groupIds.every(id => newSet.has(id));
      
      if (allSelected) {
          groupIds.forEach(id => newSet.delete(id));
      } else {
          groupIds.forEach(id => newSet.add(id));
      }
      
      setSelectedIds(newSet);
  };

  const handleBatchDelete = () => {
      if (selectedIds.size === 0) return;
      
      Alert.alert(
          "Excluir Transações",
          `Tem certeza que deseja excluir ${selectedIds.size} transações selecionadas?`,
          [
              { text: "Cancelar", style: "cancel" },
              { 
                  text: "Excluir", 
                  style: "destructive",
                  onPress: async () => {
                      try {
                          setLoading(true);
                          await transactionService.deleteMany(Array.from(selectedIds));
                          setSelectedIds(new Set());
                          setIsSelectionMode(false);
                          setPage(0);
                          await fetchTransactions(0, true);
                      } catch (error) {
                          console.error(error);
                          Alert.alert("Erro", "Não foi possível excluir as transações.");
                      } finally {
                          setLoading(false);
                      }
                  }
              }
          ]
      );
  };

  const handleImportFP3 = async () => {
      try {
          const result = await DocumentPicker.getDocumentAsync({
              type: '*/*',
              copyToCacheDirectory: true
          });

          if (result.canceled) return;

          setIsImporting(true);
          const file = result.assets[0];
          
          if (!file.name.toLowerCase().endsWith('.fp3')) {
              Alert.alert('Erro', 'Por favor, selecione um arquivo .fp3 válido.');
              setIsImporting(false);
              return;
          }

          const content = await FileSystem.readAsStringAsync(file.uri);
          
          let startDate = null;
          let endDate = null;
          const periodMatch = content.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:a|até|ate|-|à)\s*(\d{2}\/\d{2}\/\d{4})/i);
          if (periodMatch) {
              const parseDateString = (d) => { 
                  const [day, month, year] = d.split('/'); 
                  return new Date(year, month - 1, day).getTime(); 
              };
              startDate = parseDateString(periodMatch[1]);
              endDate = parseDateString(periodMatch[2]);
          }

          const dateRegex = /<m32 l="0" t="\d+" u="(\d{2}\/\d{2}\/\d{4})"\/>/g;
          const dates = [];
          let dateMatch;
          while ((dateMatch = dateRegex.exec(content)) !== null) {
              const dateStr = dateMatch[1];
              if (!dates.includes(dateStr)) {
                  let isValid = true;
                  if (startDate && endDate) {
                      const [day, month, year] = dateStr.split('/');
                      const dTime = new Date(year, month - 1, day).getTime();
                      if (dTime < startDate || dTime > endDate) {
                          isValid = false;
                      }
                  }
                  if (isValid) {
                      dates.push(dateStr);
                  }
              }
          }

          const positionToMethodMap = {
              87: { name: 'Dinheiro', id: 'dinheiro' },
              162: { name: 'Cartão de Crédito', id: 'cartao' },
              237: { name: 'Cartão de Débito', id: 'debito' },
              312: { name: 'Crédito Loja (fiado)', id: 'credito_loja' },
              387: { name: 'Vale Alimentação', id: 'vale_alimentacao' },
              462: { name: 'Vale Combustível', id: 'vale_combustivel' },
              537: { name: 'PIX', id: 'pix' },
          };

          const rowBands = content.split('<TfrxNullBand Height="19"');
          const dataRows = rowBands.slice(1);
          
          const newTransactions = [];
          
          for (let i = 0; i < dataRows.length && i < dates.length; i++) {
              const rowContent = dataRows[i];
              const valueRegex = /<m18 l="(\d+)"[^>]*u="([\d.]+,\d{2})"\/>/g;
              let valueMatch;
              
              while ((valueMatch = valueRegex.exec(rowContent)) !== null) {
                  const lPos = parseInt(valueMatch[1], 10);
                  const valStr = valueMatch[2];
                  
                  const amountStr = valStr.replace(/\./g, '').replace(',', '.');
                  const amount = parseFloat(amountStr);
                  
                  if (!isNaN(amount) && amount > 0) {
                      let methodId = 'diversos';
                      for (const [pos, methodObj] of Object.entries(positionToMethodMap)) {
                          if (Math.abs(lPos - parseInt(pos, 10)) <= 5) {
                              methodId = methodObj.id;
                              break;
                          }
                      }
                      
                      const [day, month, year] = dates[i].split('/');
                      const formattedDate = `${year}-${month}-${day}`;
                      
                      newTransactions.push({
                          description: `Lucro Padaria`,
                          amount: amount,
                          type: 'income',
                          date: formattedDate,
                          status: 'Pago',
                          expense_type: 'variable',
                          payment_method: methodId,
                          is_bakery_income: true,
                          user_id: user.id
                      });
                  }
              }
          }

          if (newTransactions.length > 0) {
              const datesToImport = [...new Set(newTransactions.map(t => t.date))];
              const existingData = await transactionService.checkExistingBakeryIncome(user.id, datesToImport);
              
              if (existingData && existingData.length > 0) {
                  const existingDates = existingData.map(d => d.date);
                  
                  Alert.alert(
                      "Atenção: Dados Duplicados",
                      "Foram encontrados dados de vendas da padaria que já existem no sistema para algumas das datas do arquivo.\n\nO que deseja fazer?",
                      [
                          { 
                              text: "Cancelar", 
                              style: "cancel", 
                              onPress: () => setIsImporting(false) 
                          },
                          { 
                              text: "Ignorar Duplicados", 
                              onPress: async () => {
                                  const filteredTransactions = newTransactions.filter(t => !existingDates.includes(t.date));
                                  if (filteredTransactions.length > 0) {
                                      await saveImportedTransactions(filteredTransactions);
                                  } else {
                                      Alert.alert("Aviso", "Não há novos dados para importar após remover os duplicados.");
                                      setIsImporting(false);
                                  }
                              }
                          },
                          { 
                              text: "Importar Tudo (Duplicar)", 
                              style: "destructive",
                              onPress: async () => {
                                  await saveImportedTransactions(newTransactions);
                              }
                          }
                      ]
                  );
              } else {
                  await saveImportedTransactions(newTransactions);
              }
          } else {
              Alert.alert('Erro', 'Não foi possível identificar valores. Verifique o arquivo.');
              setIsImporting(false);
          }
      } catch (error) {
          console.error(error);
          Alert.alert('Erro', 'Ocorreu um erro ao importar o arquivo.');
          setIsImporting(false);
      }
  };

  const saveImportedTransactions = async (transactionsToSave) => {
      try {
          await transactionService.createMany(transactionsToSave);
          Alert.alert('Sucesso', 'Importação salva com sucesso!');
          await fetchTransactions();
      } catch (error) {
          console.error(error);
          Alert.alert('Erro', 'Erro ao salvar transações importadas.');
      } finally {
          setIsImporting(false);
      }
  };

  const FilterTab = ({ label, value, activeValue, onPress }) => (
    <TouchableOpacity
      onPress={() => onPress(activeValue === value ? 'all' : value)}
      className={`px-5 py-2.5 rounded-full mr-2 border shadow-sm ${
        activeValue === value 
          ? 'bg-[#7E1A8B] border-[#7E1A8B] shadow-purple-200' 
          : 'bg-white border-gray-100 shadow-gray-100'
      }`}
    >
      <Text className={activeValue === value ? 'text-white font-bold' : 'text-gray-600 font-medium'}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 py-6 bg-white rounded-b-[40px] shadow-sm shadow-gray-200 z-10">
        <View className="flex-row justify-between items-center mb-6">
          <View>
              <Text className="text-3xl font-extrabold text-gray-900 tracking-tight">Transações</Text>
              <Text className="text-gray-500 text-sm font-medium mt-1">Gerencie todos os seus registros</Text>
          </View>
          <View className="flex-row items-center space-x-2">
              {isSelectionMode ? (
                  <>
                      <TouchableOpacity 
                          onPress={handleBatchDelete}
                          disabled={selectedIds.size === 0}
                          className={`h-12 px-5 rounded-full items-center justify-center flex-row shadow-sm ${selectedIds.size > 0 ? 'bg-red-50' : 'bg-gray-50'}`}
                      >
                          <Trash2 color={selectedIds.size > 0 ? "#EF4444" : "#9CA3AF"} size={20} />
                          <Text className={`ml-2 font-bold ${selectedIds.size > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                              ({selectedIds.size}) Excluir
                          </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                          onPress={() => {
                              setIsSelectionMode(false);
                              setSelectedIds(new Set());
                          }}
                          className="h-12 px-5 bg-gray-100 rounded-full items-center justify-center shadow-sm ml-2"
                      >
                          <Text className="font-bold text-gray-700">Cancelar</Text>
                      </TouchableOpacity>
                  </>
              ) : (
                  <>
                      <TouchableOpacity 
                          onPress={handleImportFP3}
                          disabled={isImporting}
                          className="h-12 w-12 bg-purple-50 rounded-full items-center justify-center mr-2 shadow-sm"
                      >
                          {isImporting ? <ActivityIndicator size="small" color="#7E1A8B" /> : <Upload color="#7E1A8B" size={22} />}
                      </TouchableOpacity>
                      <TouchableOpacity 
                          onPress={() => setIsSelectionMode(true)}
                          className="h-12 w-12 bg-gray-50 rounded-full items-center justify-center mr-2 shadow-sm"
                      >
                          <ListChecks color="#4B5563" size={22} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => navigation.navigate('AddTransaction')}
                        className="h-12 w-12 bg-[#7E1A8B] rounded-full items-center justify-center shadow-lg shadow-purple-300"
                      >
                        <Plus color="white" size={26} />
                      </TouchableOpacity>
                  </>
              )}
          </View>
        </View>

        {/* View Mode Toggle */}
        <View className="flex-row bg-gray-100/80 p-1.5 rounded-2xl mb-5 self-start">
            <TouchableOpacity 
                onPress={() => setViewMode('month')}
                className={`px-4 py-2 rounded-xl ${viewMode === 'month' ? 'bg-white shadow-sm' : ''}`}
            >
                <Text className={`text-sm font-bold ${viewMode === 'month' ? 'text-[#7E1A8B]' : 'text-gray-500'}`}>Mensal</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                onPress={() => setViewMode('year')}
                className={`px-4 py-2 rounded-xl ${viewMode === 'year' ? 'bg-white shadow-sm' : ''}`}
            >
                <Text className={`text-sm font-bold ${viewMode === 'year' ? 'text-[#7E1A8B]' : 'text-gray-500'}`}>Anual</Text>
            </TouchableOpacity>
        </View>

        <View className="mb-2">
            <MonthSelector currentDate={currentMonth} onMonthChange={setCurrentMonth} viewMode={viewMode} />
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-gray-50 rounded-2xl px-5 h-14 mb-5 border border-gray-100">
          <Search color="#9CA3AF" size={22} />
          <TextInput
            placeholder="Buscar transações..."
            value={search}
            onChangeText={setSearch}
            className="flex-1 ml-3 text-base text-gray-900 font-medium"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Filters */}
        <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row pb-2">
                <FilterTab label="Todas" value="all" activeValue={filter} onPress={setFilter} />
                <FilterTab label="Entradas" value="income" activeValue={filter} onPress={setFilter} />
                <TouchableOpacity
                    onPress={() => setFilter(filter === 'bakery_income' ? 'all' : 'bakery_income')}
                    className={`px-5 py-2.5 rounded-full mr-2 border flex-row items-center ${
                        filter === 'bakery_income' 
                        ? 'bg-purple-50 border-purple-200 shadow-sm shadow-purple-100' 
                        : 'bg-white border-gray-100 shadow-sm shadow-gray-100'
                    }`}
                >
                    <Text className="mr-1.5 text-base">🍞</Text>
                    <Text className={filter === 'bakery_income' ? 'text-[#7E1A8B] font-bold' : 'text-gray-600 font-medium'}>
                        Só Padaria
                    </Text>
                </TouchableOpacity>
                <FilterTab label="Saídas" value="expense" activeValue={filter} onPress={setFilter} />
                <View className="w-4 border-l border-gray-200 mx-2 my-2" />
                <FilterTab label="Pix" value="pix" activeValue={methodFilter} onPress={setMethodFilter} />
                <FilterTab label="Dinheiro" value="dinheiro" activeValue={methodFilter} onPress={setMethodFilter} />
                <FilterTab label="C. Crédito" value="cartao" activeValue={methodFilter} onPress={setMethodFilter} />
                <FilterTab label="C. Débito" value="debito" activeValue={methodFilter} onPress={setMethodFilter} />
                <FilterTab label="Fiado" value="credito_loja" activeValue={methodFilter} onPress={setMethodFilter} />
                <FilterTab label="V. Alimentação" value="vale_alimentacao" activeValue={methodFilter} onPress={setMethodFilter} />
                <FilterTab label="V. Combustível" value="vale_combustivel" activeValue={methodFilter} onPress={setMethodFilter} />
                <FilterTab label="Diversos" value="diversos" activeValue={methodFilter} onPress={setMethodFilter} />
            </ScrollView>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center bg-gray-50">
          <ActivityIndicator size="large" color="#7E1A8B" />
        </View>
      ) : (
        <ScrollView 
            contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            className="flex-1"
        >
            {sortedGroupKeys.length === 0 ? (
                <View className="items-center justify-center py-16">
                    <View className="bg-gray-100 p-6 rounded-full mb-4">
                        <Calendar color="#9CA3AF" size={48} />
                    </View>
                    <Text className="text-gray-900 text-lg font-bold">Nenhuma transação</Text>
                    <Text className="text-gray-500 font-medium mt-1 text-center">Tente mudar os filtros ou o período{'\n'}para ver mais resultados.</Text>
                </View>
            ) : (
                <View className="space-y-6">
                    {sortedGroupKeys.map(key => {
                        const groupTransactions = groupedTransactions[key];
                        const groupTotal = calculateGroupTotal(groupTransactions);
                        
                        return (
                            <View key={key} className="bg-white rounded-[32px] p-6 shadow-sm shadow-gray-200/50">
                                <TouchableOpacity 
                                    onPress={() => isSelectionMode && toggleGroupSelection(key)}
                                    activeOpacity={isSelectionMode ? 0.7 : 1}
                                    className="flex-row justify-between items-center mb-5 pb-4 border-b border-gray-100"
                                >
                                    <View className="flex-row items-center">
                                        {isSelectionMode && (
                                            <View className={`h-7 w-7 rounded-xl border-2 mr-4 items-center justify-center ${
                                                groupTransactions.every(t => selectedIds.has(t.id))
                                                    ? "bg-[#7E1A8B] border-[#7E1A8B]" 
                                                    : groupTransactions.some(t => selectedIds.has(t.id))
                                                        ? "bg-purple-50 border-[#7E1A8B]"
                                                        : "bg-gray-50 border-gray-300"
                                            }`}>
                                                {groupTransactions.every(t => selectedIds.has(t.id)) && <Text className="text-white text-sm font-bold">✓</Text>}
                                                {!groupTransactions.every(t => selectedIds.has(t.id)) && groupTransactions.some(t => selectedIds.has(t.id)) && <View className="h-3 w-3 rounded-md bg-[#7E1A8B]" />}
                                            </View>
                                        )}
                                        <Text className="text-lg font-extrabold text-gray-900 capitalize">
                                            {getGroupLabel(key)}
                                        </Text>
                                    </View>
                                    <View className={`px-3 py-1.5 rounded-xl ${groupTotal >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                        <Text className={`text-sm font-bold ${groupTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {groupTotal >= 0 ? '+' : ''}{groupTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                <View className="space-y-4">
                                    {groupTransactions.map((item, index) => (
                                        <View key={item.id} className={index < groupTransactions.length - 1 ? "mb-4" : ""}>
                                            <TransactionItem 
                                                transaction={item} 
                                                onPress={() => isSelectionMode ? toggleSelection(item.id) : handleEdit(item)}
                                                onEdit={() => handleEdit(item)}
                                                onDelete={() => handleDelete(item)}
                                                isSelected={selectedIds.has(item.id)}
                                                isSelectionMode={isSelectionMode}
                                            />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        );
                    })}
                    
                    {hasMore && (
                        <TouchableOpacity 
                            onPress={loadMore}
                            disabled={loadingMore}
                            className="bg-purple-50 py-4 rounded-2xl items-center justify-center mt-4 mb-6"
                        >
                            {loadingMore ? (
                                <ActivityIndicator size="small" color="#7E1A8B" />
                            ) : (
                                <Text className="text-[#7E1A8B] font-bold text-base">Carregar Mais</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
