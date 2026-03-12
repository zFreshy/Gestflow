import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { transactionService } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';
import { PieChart, BarChart } from "react-native-gifted-charts";
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, ArrowDownRight, Calendar, ChevronRight } from 'lucide-react-native';
import { formatCurrency } from '../utils';

const screenWidth = Dimensions.get('window').width;

export function DashboardPage({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [viewMode, setViewMode] = useState('weekly'); // weekly, monthly, quarterly
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    categories: [] // For donut chart
  });

  const fetchTransactions = async () => {
    try {
      const data = await transactionService.getAll(user.id);
      setTransactions(data || []);
      calculateFinancials(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateFinancials = (data) => {
    const totalIncome = data
        .filter(t => t.type === 'income')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const totalExpense = data
        .filter(t => t.type === 'expense')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const netProfit = totalIncome - totalExpense;

    // Categories for Donut Chart (Expenses by Category)
    const expensesByCategory = data
        .filter(t => t.type === 'expense')
        .reduce((acc, curr) => {
            const category = curr.category || 'Outros';
            acc[category] = (acc[category] || 0) + curr.amount;
            return acc;
        }, {});

    const pieData = Object.keys(expensesByCategory).map((cat, index) => ({
        value: expensesByCategory[cat],
        text: cat,
        color: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5],
    }));
    
    // If no expenses, show a placeholder or income vs expense
    const finalPieData = pieData.length > 0 ? pieData : [
        { value: totalIncome, color: '#10B981', text: 'Receitas' },
        { value: totalExpense, color: '#EF4444', text: 'Despesas' }
    ].filter(d => d.value > 0);

    setStats({
      totalIncome,
      totalExpense,
      netProfit,
      categories: finalPieData
    });
  };

  const barChartData = useMemo(() => {
    if (!transactions.length) return [];
    
    const today = new Date();
    const data = [];
    
    const parseDate = (dateStr) => {
        const [d, m, y] = dateStr.split('/');
        return new Date(y, m - 1, d);
    };

    if (viewMode === 'weekly') {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('pt-BR').slice(0, 5); // DD/MM
            
            const dayTransactions = transactions.filter(t => {
                const tDate = parseDate(t.date);
                return tDate.getDate() === d.getDate() && 
                       tDate.getMonth() === d.getMonth() &&
                       tDate.getFullYear() === d.getFullYear();
            });

            const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            
            data.push({
                value: income - expense, // Profit/Loss
                label: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()],
                frontColor: (income - expense) >= 0 ? '#10B981' : '#EF4444',
                topLabelComponent: () => (
                    <Text style={{color: (income - expense) >= 0 ? '#10B981' : '#EF4444', fontSize: 10, marginBottom: 6}}>
                        {Math.abs(income - expense).toFixed(0)}
                    </Text>
                )
            });
        }
    } else if (viewMode === 'monthly') {
        // Last 30 days grouped by 5 days or weeks? Or just last 4 weeks?
        // Let's do last 4 weeks
        for (let i = 3; i >= 0; i--) {
            const end = new Date(today);
            end.setDate(end.getDate() - (i * 7));
            const start = new Date(end);
            start.setDate(start.getDate() - 6);
            
            const label = `${start.getDate()}/${start.getMonth()+1}`;

            const weekTransactions = transactions.filter(t => {
                const tDate = parseDate(t.date);
                return tDate >= start && tDate <= end;
            });

            const income = weekTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expense = weekTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

            data.push({
                value: income - expense,
                label,
                frontColor: (income - expense) >= 0 ? '#10B981' : '#EF4444',
            });
        }
    } else if (viewMode === 'quarterly') {
        // Last 3 months
        for (let i = 2; i >= 0; i--) {
            const d = new Date(today);
            d.setMonth(d.getMonth() - i);
            const monthName = d.toLocaleDateString('pt-BR', { month: 'short' });
            
            const monthTransactions = transactions.filter(t => {
                const tDate = parseDate(t.date);
                return tDate.getMonth() === d.getMonth() && tDate.getFullYear() === d.getFullYear();
            });

            const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

            data.push({
                value: income - expense,
                label: monthName,
                frontColor: (income - expense) >= 0 ? '#10B981' : '#EF4444',
            });
        }
    }
    
    return data;
  }, [transactions, viewMode]);

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransactions();
  }, []);

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#7E1A8B" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7E1A8B"]} tintColor="#7E1A8B" />
        }
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-4 bg-white mb-6 border-b border-gray-100">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-gray-500 text-sm">Bem-vindo de volta,</Text>
              <Text className="text-2xl font-bold text-gray-900">
                {/* {user?.email?.split('@')[0] || 'Usuário'} */}
                Nal
              </Text>
            </View>
            <View className="h-10 w-10 bg-purple-50 rounded-full items-center justify-center border border-purple-100">
              <Text className="text-purple-600 font-bold text-lg">
                {(user?.email?.[0] || 'U').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-6 space-y-8">
            {/* Donut Chart Section */}
            <View className="items-center">
                <View className="w-full flex-row justify-between items-center mb-4">
                    <Text className="text-xl font-bold text-gray-900">Visão Geral</Text>
                    <TouchableOpacity className="bg-gray-100 p-2 rounded-full">
                        <ArrowUpRight size={20} color="#374151" />
                    </TouchableOpacity>
                </View>
                
                <View className="items-center justify-center relative">
                    <PieChart
                        data={stats.categories}
                        donut
                        radius={120}
                        innerRadius={80}
                        centerLabelComponent={() => {
                            return (
                                <View className="items-center justify-center">
                                    <Text className="text-gray-500 text-sm font-medium">Total</Text>
                                    <Text className="text-gray-900 text-2xl font-bold">
                                        {formatCurrency(stats.totalExpense)}
                                    </Text>
                                </View>
                            );
                        }}
                    />
                </View>

                {/* Legend */}
                <View className="flex-row flex-wrap justify-center gap-4 mt-6 w-full">
                    {stats.categories.map((cat, idx) => (
                        <View key={idx} className="flex-col items-center min-w-[30%]">
                            <Text className="text-gray-500 text-xs mb-1">{cat.text}</Text>
                            <Text className="text-gray-900 font-bold text-lg">
                                {((cat.value / (stats.totalExpense || 1)) * 100).toFixed(0)}%
                            </Text>
                            <View 
                                style={{ backgroundColor: cat.color, height: 4, width: 40, borderRadius: 2 }} 
                            />
                        </View>
                    ))}
                </View>
            </View>

            {/* Card Carousel */}
            <View>
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-xl font-bold text-gray-900">Resumo Financeiro</Text>
                    <Text className="text-gray-400 text-sm">Ver todos</Text>
                </View>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
                    <View className="flex-row gap-4 pb-4">
                        {/* Income Card */}
                        <View className="w-[280px] h-[160px] rounded-[32px] overflow-hidden">
                            <LinearGradient
                                colors={['#ECFDF5', '#D1FAE5']}
                                className="flex-1 p-6 justify-between"
                            >
                                <View className="flex-row justify-between items-start">
                                    <View className="bg-emerald-100 p-2 rounded-full">
                                        <ArrowUpRight size={20} color="#10B981" />
                                    </View>
                                    <View className="bg-emerald-200/50 px-3 py-1 rounded-full">
                                        <Text className="text-emerald-700 font-medium text-xs">+ Receitas</Text>
                                    </View>
                                </View>
                                <View>
                                    <Text className="text-emerald-900/60 text-sm font-medium mb-1">Total Receitas</Text>
                                    <Text className="text-emerald-900 text-3xl font-bold">{formatCurrency(stats.totalIncome)}</Text>
                                </View>
                            </LinearGradient>
                        </View>

                        {/* Expense Card */}
                        <View className="w-[280px] h-[160px] rounded-[32px] overflow-hidden">
                            <LinearGradient
                                colors={['#FEF2F2', '#FEE2E2']}
                                className="flex-1 p-6 justify-between"
                            >
                                <View className="flex-row justify-between items-start">
                                    <View className="bg-red-100 p-2 rounded-full">
                                        <ArrowDownRight size={20} color="#EF4444" />
                                    </View>
                                    <View className="bg-red-200/50 px-3 py-1 rounded-full">
                                        <Text className="text-red-700 font-medium text-xs">- Despesas</Text>
                                    </View>
                                </View>
                                <View>
                                    <Text className="text-red-900/60 text-sm font-medium mb-1">Total Despesas</Text>
                                    <Text className="text-red-900 text-3xl font-bold">{formatCurrency(stats.totalExpense)}</Text>
                                </View>
                            </LinearGradient>
                        </View>

                         {/* Profit Card */}
                         <View className="w-[280px] h-[160px] rounded-[32px] overflow-hidden">
                            <LinearGradient
                                colors={['#EFF6FF', '#DBEAFE']}
                                className="flex-1 p-6 justify-between"
                            >
                                <View className="flex-row justify-between items-start">
                                    <View className="bg-blue-100 p-2 rounded-full">
                                        <ArrowUpRight size={20} color="#3B82F6" />
                                    </View>
                                    <View className="bg-blue-200/50 px-3 py-1 rounded-full">
                                        <Text className="text-blue-700 font-medium text-xs">= Saldo</Text>
                                    </View>
                                </View>
                                <View>
                                    <Text className="text-blue-900/60 text-sm font-medium mb-1">Saldo Líquido</Text>
                                    <Text className="text-blue-900 text-3xl font-bold">{formatCurrency(stats.netProfit)}</Text>
                                </View>
                            </LinearGradient>
                        </View>
                    </View>
                </ScrollView>
            </View>

            {/* Bar Chart Section */}
            <View className="mb-8">
                <View className="mb-6">
                    <Text className="text-gray-500 text-sm mb-1">Desempenho</Text>
                    <Text className="text-3xl font-bold text-gray-900">
                        {stats.netProfit >= 0 ? '+' : ''}{((stats.netProfit / (stats.totalIncome || 1)) * 100).toFixed(1)}%
                    </Text>
                </View>

                {/* View Toggles */}
                <View className="flex-row justify-between mb-6 bg-gray-100 p-1 rounded-2xl">
                    {['weekly', 'monthly', 'quarterly'].map((mode) => (
                        <TouchableOpacity
                            key={mode}
                            onPress={() => setViewMode(mode)}
                            className={`flex-1 py-3 items-center rounded-xl ${viewMode === mode ? 'bg-black shadow-sm' : ''}`}
                        >
                            <Text className={`font-medium ${viewMode === mode ? 'text-white' : 'text-gray-500'}`} style={{ fontSize: 12 }}>
                                {mode === 'weekly' ? 'Semana' : mode === 'monthly' ? 'Mês' : 'Trimestre'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Chart */}
                <View className="items-center overflow-hidden">
                     <BarChart
                        data={barChartData}
                        barWidth={32}
                        spacing={24}
                        roundedTop
                        roundedBottom
                        hideRules
                        xAxisThickness={0}
                        yAxisThickness={0}
                        yAxisTextStyle={{ color: 'gray' }}
                        noOfSections={3}
                        maxValue={Math.max(...barChartData.map(d => Math.abs(d.value)), 100) * 1.2}
                        width={screenWidth - 80}
                        height={200}
                        isAnimated
                        frontColor={'#10B981'}
                    />
                </View>
            </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}