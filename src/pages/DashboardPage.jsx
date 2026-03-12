import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { transactionService } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';
import { StatCard } from '../components/molecules/StatCard';
import { FinancesChart } from '../components/organisms/FinancesChart';
import { DollarSign, TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle, Calendar } from 'lucide-react-native';
import { Button } from '../components/atoms/Button';
import { formatCurrency } from '../utils';

export function DashboardPage({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    upcomingTotal: 0,
    overdueTotal: 0,
    paidFixedTotal: 0,
    upcomingCount: 0,
    overdueCount: 0,
    paidFixedCount: 0,
    averages: {
      daily: { income: 0, expense: 0, profit: 0 },
      monthly: { income: 0, expense: 0, profit: 0 },
      yearly: { income: 0, expense: 0, profit: 0 }
    }
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getTransactionDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    };

    // Helper to normalize status (assuming 'status' field exists or defaulting to 'Aguardando' for future dates)
    // Since mobile DB might not have 'status' yet, we infer: 
    // - If date < today: Paid (for simplicity unless specified)
    // - If date >= today: Pending
    const isPaid = (t) => {
        // Real logic should use t.status === 'Pago'
        // Fallback logic for now:
        return t.status === 'Pago' || t.status === 'Liberado' || (getTransactionDate(t.date) < today);
    };
    
    const isPending = (t) => !isPaid(t);

    // 1. Totals
    const totalIncome = data
        .filter(t => t.type === 'income')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const totalExpense = data
        .filter(t => t.type === 'expense')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const netProfit = totalIncome - totalExpense;

    // 2. Projections (Virtual Expenses) - Simplified for Mobile
    // Ideally we duplicate the full logic from Web, but here we'll filter existing ones first
    const fixedExpenses = data.filter(t => t.type === 'expense' && t.expenseType === 'fixed');
    
    const upcomingExpenses = fixedExpenses.filter(t => getTransactionDate(t.date) >= today);
    const overdueExpenses = fixedExpenses.filter(t => getTransactionDate(t.date) < today && !isPaid(t)); // Only if we track status properly
    const paidFixedExpenses = fixedExpenses.filter(t => isPaid(t));

    // 3. Averages
    const uniqueDates = new Set(data.map(t => t.date)).size || 1;
    const uniqueMonths = new Set(data.map(t => {
        const [d, m, y] = t.date.split('/');
        return `${m}/${y}`;
    })).size || 1;
    const uniqueYears = new Set(data.map(t => {
        const [d, m, y] = t.date.split('/');
        return y;
    })).size || 1;

    setStats({
      totalIncome,
      totalExpense,
      netProfit,
      upcomingTotal: upcomingExpenses.reduce((acc, t) => acc + t.amount, 0),
      overdueTotal: overdueExpenses.reduce((acc, t) => acc + t.amount, 0),
      paidFixedTotal: paidFixedExpenses.reduce((acc, t) => acc + t.amount, 0),
      upcomingCount: upcomingExpenses.length,
      overdueCount: overdueExpenses.length,
      paidFixedCount: paidFixedExpenses.length,
      averages: {
        daily: { 
            income: totalIncome / uniqueDates, 
            expense: totalExpense / uniqueDates, 
            profit: (totalIncome - totalExpense) / uniqueDates 
        },
        monthly: { 
            income: totalIncome / uniqueMonths, 
            expense: totalExpense / uniqueMonths, 
            profit: (totalIncome - totalExpense) / uniqueMonths 
        },
        yearly: { 
            income: totalIncome / uniqueYears, 
            expense: totalExpense / uniqueYears, 
            profit: (totalIncome - totalExpense) / uniqueYears 
        }
      }
    });
  };

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
      <View className="flex-1 justify-center items-center bg-[#09090b]">
        <ActivityIndicator size="large" color="#7E1A8B" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#09090b]">
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7E1A8B"]} tintColor="#7E1A8B" />
        }
      >
        {/* Header */}
        <View className="px-6 pt-6 pb-4 bg-[#18181b] rounded-b-[32px] shadow-sm mb-6 border-b border-zinc-800">
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-zinc-400 text-sm">Bem-vindo de volta,</Text>
              <Text className="text-2xl font-bold text-white">
                {user?.email?.split('@')[0] || 'Usuário'}
              </Text>
            </View>
            <View className="h-10 w-10 bg-purple-500/10 rounded-full items-center justify-center border border-purple-500/20">
              <Text className="text-purple-400 font-bold text-lg">
                {(user?.email?.[0] || 'U').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-6 space-y-6">
            {/* Top Stats - Financial Overview - GRID LAYOUT */}
            <View className="flex-row flex-wrap justify-between gap-3">
                <StatCard
                    title="Lucro Total"
                    icon={DollarSign}
                    accent="green"
                    value={stats.totalIncome}
                    className="min-w-[45%]"
                >
                    <View className="flex-row items-center gap-1 mt-1 bg-emerald-500/10 self-start px-2 py-0.5 rounded-full">
                        <TrendingUp size={12} color="#34D399" />
                        <Text className="text-emerald-400 text-xs font-medium">Receitas</Text>
                    </View>
                </StatCard>

                <StatCard
                    title="Despesas Totais"
                    icon={DollarSign}
                    accent="red"
                    value={stats.totalExpense}
                    className="min-w-[45%]"
                >
                    <View className="flex-row items-center gap-1 mt-1 bg-red-500/10 self-start px-2 py-0.5 rounded-full">
                        <TrendingDown size={12} color="#F87171" />
                        <Text className="text-red-400 text-xs font-medium">Gastos</Text>
                    </View>
                </StatCard>

                <StatCard
                    title="Lucro Líquido"
                    icon={TrendingUp}
                    accent="blue"
                    value={stats.netProfit}
                    subtext="Saldo Atual"
                    className="w-full min-w-full"
                />
            </View>

            {/* Expenses Status Row - GRID LAYOUT */}
            <View className="flex-row flex-wrap justify-between gap-3">
                <StatCard
                    title="Despesas por Vir"
                    icon={Clock}
                    accent="yellow"
                    value={stats.upcomingTotal}
                    className="min-w-[45%]"
                >
                    <View className="flex-row items-center gap-1 mt-1 bg-amber-500/10 self-start px-2 py-0.5 rounded-full">
                        <Text className="text-amber-400 text-xs font-medium">{stats.upcomingCount} pendentes</Text>
                    </View>
                </StatCard>

                <StatCard
                    title="Despesas Atrasadas"
                    icon={AlertCircle}
                    accent="red"
                    value={stats.overdueTotal}
                    className="min-w-[45%]"
                >
                    <View className="flex-row items-center gap-1 mt-1 bg-red-500/10 self-start px-2 py-0.5 rounded-full">
                        <Text className="text-red-400 text-xs font-medium">{stats.overdueCount} vencidas</Text>
                    </View>
                </StatCard>

                <StatCard
                    title="Fixas Pagas"
                    icon={CheckCircle}
                    accent="green"
                    value={stats.paidFixedTotal}
                    className="w-full min-w-full"
                >
                    <View className="flex-row items-center gap-1 mt-1 bg-emerald-500/10 self-start px-2 py-0.5 rounded-full">
                        <Text className="text-emerald-400 text-xs font-medium">{stats.paidFixedCount} pagas</Text>
                    </View>
                </StatCard>
            </View>

            {/* Finances Chart */}
            <FinancesChart transactions={transactions} />

            {/* Averages Section */}
            <View>
                <Text className="text-lg font-bold text-white mb-4">Médias</Text>
                <View className="flex-col gap-4">
                    {/* Daily */}
                    <View className="bg-[#18181b] p-4 rounded-2xl border border-zinc-800 shadow-sm">
                        <View className="flex-row items-center gap-2 mb-3">
                            <View className="p-2 bg-blue-500/10 rounded-lg"><TrendingUp size={16} color="#60A5FA" /></View>
                            <Text className="font-semibold text-zinc-300">Média Diária</Text>
                        </View>
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-zinc-500 text-xs">Lucro</Text>
                            <Text className="text-emerald-400 font-medium text-xs">{formatCurrency(stats.averages.daily.income)}</Text>
                        </View>
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-zinc-500 text-xs">Despesa</Text>
                            <Text className="text-red-400 font-medium text-xs">{formatCurrency(stats.averages.daily.expense)}</Text>
                        </View>
                        <View className="h-px bg-zinc-800 my-2" />
                        <View className="flex-row justify-between">
                            <Text className="text-white font-medium text-xs">Saldo</Text>
                            <Text className={`font-bold text-xs ${stats.averages.daily.profit >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                {formatCurrency(stats.averages.daily.profit)}
                            </Text>
                        </View>
                    </View>

                    {/* Monthly */}
                    <View className="bg-[#18181b] p-4 rounded-2xl border border-zinc-800 shadow-sm">
                        <View className="flex-row items-center gap-2 mb-3">
                            <View className="p-2 bg-purple-500/10 rounded-lg"><Calendar size={16} color="#C084FC" /></View>
                            <Text className="font-semibold text-zinc-300">Média Mensal</Text>
                        </View>
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-zinc-500 text-xs">Lucro</Text>
                            <Text className="text-emerald-400 font-medium text-xs">{formatCurrency(stats.averages.monthly.income)}</Text>
                        </View>
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-zinc-500 text-xs">Despesa</Text>
                            <Text className="text-red-400 font-medium text-xs">{formatCurrency(stats.averages.monthly.expense)}</Text>
                        </View>
                        <View className="h-px bg-zinc-800 my-2" />
                        <View className="flex-row justify-between">
                            <Text className="text-white font-medium text-xs">Saldo</Text>
                            <Text className={`font-bold text-xs ${stats.averages.monthly.profit >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                {formatCurrency(stats.averages.monthly.profit)}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Quick Actions */}
            <View className="mt-4">
                <Button 
                    title="Nova Transação" 
                    onPress={() => navigation.navigate('AddTransaction')}
                    className="bg-zinc-800 shadow-none border border-zinc-700"
                    textClassName="text-white"
                />
            </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}