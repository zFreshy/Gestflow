import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { transactionService } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';
import { BarChart, PieChart } from "react-native-gifted-charts";
import Svg, { Circle, Path, G } from 'react-native-svg';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  DollarSign, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Users, 
  Activity
} from 'lucide-react-native';
import { formatCurrency } from '../utils';

const screenWidth = Dimensions.get('window').width;

// Custom Donut Chart with semicircle transitions
const DonutChartWithTransitions = ({ data, radius = 120, innerRadius = 80, centerLabel }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const strokeWidth = radius - innerRadius;
  const circleRadius = strokeWidth / 2;
  
  let currentAngle = -90; // Start from top
  
  const segments = data.map((item, index) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    
    // Calculate path for the segment
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const centerCircleRadius = (radius + innerRadius) / 2;
    
    const x1 = radius + centerCircleRadius * Math.cos(startRad);
    const y1 = radius + centerCircleRadius * Math.sin(startRad);
    const x2 = radius + centerCircleRadius * Math.cos(endRad);
    const y2 = radius + centerCircleRadius * Math.sin(endRad);
    
    // Calculate middle point for label
    const midAngle = (startAngle + endAngle) / 2;
    const midRad = (midAngle * Math.PI) / 180;
    const labelRadius = centerCircleRadius + strokeWidth / 2 + 20;
    const labelX = radius + labelRadius * Math.cos(midRad);
    const labelY = radius + labelRadius * Math.sin(midRad);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    const pathData = `
      M ${x1} ${y1}
      A ${centerCircleRadius} ${centerCircleRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}
    `;
    
    currentAngle = endAngle;
    
    return {
      path: pathData,
      color: item.color,
      startX: x1,
      startY: y1,
      endX: x2,
      endY: y2,
      labelX,
      labelY,
      value: item.value,
      percentage
    };
  });
  
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={radius * 2 + 80} height={radius * 2 + 80}>
        <G transform={`translate(40, 40)`}>
          {segments.map((segment, index) => (
            <G key={index}>
              <Path
                d={segment.path}
                stroke={segment.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
              {/* Semicircle at the end of each segment */}
              <Circle
                cx={segment.endX}
                cy={segment.endY}
                r={circleRadius}
                fill={segment.color}
              />
            </G>
          ))}
        </G>
      </Svg>
      
      {/* Labels positioned around the chart */}
      {segments.map((segment, index) => (
        <View
          key={`label-${index}`}
          style={{
            position: 'absolute',
            left: segment.labelX + 40 - 35,
            top: segment.labelY + 40 - 15,
            backgroundColor: 'rgba(0,0,0,0.7)',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            minWidth: 70,
            alignItems: 'center'
          }}
        >
          <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
            {formatCurrency(segment.value)}
          </Text>
        </View>
      ))}
      
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {centerLabel}
      </View>
    </View>
  );
};

// Helpers
const isPaid = (status) => ['pago', 'liberado'].includes(status?.toLowerCase());
const isPending = (status) => ['aguardando', 'pendente'].includes(status?.toLowerCase());

const getTransactionDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    
    // Check if date is in ISO format YYYY-MM-DD
    if (dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-');
        return new Date(year, month - 1, day);
    }
    
    // Check if date is in DD/MM/YYYY format
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    }

    return new Date(dateStr); // Fallback
};

const calculateNextOccurrence = (expense, today) => {
    const expenseDate = getTransactionDate(expense.date);
    
    // If expense is in the future, that's the next occurrence
    if (expenseDate >= today) return expenseDate;

    // If in the past, calculate next based on recurrence
    let nextDate = new Date(expenseDate);
    while (nextDate < today) {
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
    categories: [], // For donut chart
    upcomingTotal: 0,
    upcomingCount: 0,
    overdueTotal: 0,
    overdueCount: 0,
    paidFixedTotal: 0,
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
      
      // Map Supabase snake_case to camelCase
      const mappedData = (data || []).map(t => {
          return {
              ...t,
              // Map common snake_case fields to camelCase if they exist
              expenseType: t.expense_type || t.expenseType,
              paymentMethod: t.payment_method || t.paymentMethod,
              userId: t.user_id || t.userId,
              createdAt: t.created_at || t.createdAt
          };
      });

      setTransactions(mappedData);
      calculateFinancials(mappedData);
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

    // 1. Financial Totals
    const totalIncome = data
        .filter(t => t.type === 'income')
        .reduce((acc, curr) => acc + curr.amount, 0);

    // Total expense logic:
    // 1. Variable expenses: ALL of them
    // 2. Fixed expenses: ONLY if status is Paid
    const totalExpense = data
        .filter(t => {
            if (t.type !== 'expense') return false;
            if (t.expenseType === 'fixed') {
                return isPaid(t.status);
            }
            return true; // Variable expenses always count
        })
        .reduce((acc, curr) => acc + curr.amount, 0);

    const netProfit = totalIncome - totalExpense;

    // 2. Filter for cards
    const fixedExpenses = data.filter(t => t.type === 'expense' && t.expenseType === 'fixed');
    const variableExpenses = data.filter(t => t.type === 'expense' && t.expenseType === 'variable');

    // 3. Virtual Expenses for Projections
    const recurringGroups = {};
    fixedExpenses.forEach(t => {
        if (t.recurrence) {
            const key = `${t.description}-${t.amount}-${t.recurrence}`;
            if (!recurringGroups[key] || getTransactionDate(recurringGroups[key].date) < getTransactionDate(t.date)) {
                recurringGroups[key] = t;
            }
        }
    });

    const virtualExpenses = [];
    Object.values(recurringGroups).forEach(lastExpense => {
        const lastDate = getTransactionDate(lastExpense.date);
        
        // If the last expense is in the future/today and unpaid, it's already in the list.
        if (lastDate >= today && !isPaid(lastExpense.status)) return;

        let nextDate = calculateNextOccurrence(lastExpense, today);

        // If nextDate is the same as lastDate (meaning lastDate >= today and was Paid),
        // we must project the NEXT occurrence after that.
        if (nextDate.getTime() === lastDate.getTime()) {
            const d = new Date(nextDate);
            switch (lastExpense.recurrence?.toLowerCase()) {
                case 'daily': d.setDate(d.getDate() + 1); break;
                case 'weekly': d.setDate(d.getDate() + 7); break;
                case 'monthly': d.setMonth(d.getMonth() + 1); break;
                case 'quarterly': d.setMonth(d.getMonth() + 3); break;
                case 'semiannual': d.setMonth(d.getMonth() + 6); break;
                case 'annual': d.setFullYear(d.getFullYear() + 1); break;
                case 'biennial': d.setFullYear(d.getFullYear() + 2); break;
                default: d.setMonth(d.getMonth() + 1);
            }
            nextDate = d;
        }
        
        virtualExpenses.push({
            ...lastExpense,
            id: `virtual-${lastExpense.id}-${nextDate.getTime()}`,
            date: nextDate.toLocaleDateString('pt-BR'),
            status: 'Aguardando',
            isVirtual: true
        });
    });

    // 4. Metrics
    const realUpcoming = fixedExpenses.filter(t => isPending(t.status) && getTransactionDate(t.date) >= today);
    const upcomingExpenses = [...realUpcoming, ...virtualExpenses];
    
    // Filter upcoming expenses up to the end of the next month
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 2);
    nextMonth.setDate(0); // Last day of next month
    
    const filteredUpcoming = upcomingExpenses.filter(t => getTransactionDate(t.date) <= nextMonth);
    const filteredUpcomingTotal = filteredUpcoming.reduce((acc, t) => acc + t.amount, 0);

    const overdueExpenses = fixedExpenses.filter(t => isPending(t.status) && getTransactionDate(t.date) < today);
    const paidFixedExpenses = fixedExpenses.filter(t => isPaid(t.status));

    const overdueTotal = overdueExpenses.reduce((acc, t) => acc + t.amount, 0);
    const upcomingTotal = upcomingExpenses.reduce((acc, t) => acc + t.amount, 0); // Keep original for cards? User said "até mesmo as por vir ( entre a data atual e o final do mês que está por vir ) das faturas" for the CENTER TOTAL logic.
    // The user said: "o total tirando todos os tipos de despesas, até mesmo as por vir ( entre a data atual e o final do mês que está por vir ) das faturas"
    // So the Projected Balance should subtract filteredUpcomingTotal.
    
    const projectedBalance = totalIncome - totalExpense - filteredUpcomingTotal - overdueTotal;

    // 5. Chart Data (Replacing Categories with Income/Expense types)
    // "quero que ele mostre os lucros, as despesas, as despesas por vir e as despesass atrasadas"
    const finalPieData = [
        { value: totalIncome, color: '#34D399', text: 'Receitas', focused: true }, // Emerald-400
        { value: totalExpense, color: '#F87171', text: 'Pagas' }, // Red-400
        { value: filteredUpcomingTotal, color: '#FBBF24', text: 'A Vencer' }, // Amber-400
        { value: overdueTotal, color: '#EF4444', text: 'Atrasadas' } // Red-500
    ].filter(d => d.value > 0);

    // 6. Averages
    const uniqueDates = new Set(data.map(t => t.date)).size || 1;
    const uniqueMonths = new Set(data.map(t => {
        const d = getTransactionDate(t.date);
        return `${d.getMonth() + 1}/${d.getFullYear()}`;
    })).size || 1;
    const uniqueYears = new Set(data.map(t => {
        const d = getTransactionDate(t.date);
        return d.getFullYear();
    })).size || 1;

    setStats({
      totalIncome,
      totalExpense,
      netProfit,
      projectedBalance,
      categories: finalPieData,
      upcomingTotal,
      upcomingCount: upcomingExpenses.length,
      overdueTotal,
      overdueCount: overdueExpenses.length,
      paidFixedTotal: paidFixedExpenses.reduce((acc, t) => acc + t.amount, 0),
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

  const barChartData = useMemo(() => {
    if (!transactions.length) return [];
    
    const today = new Date();
    const data = [];
    
    // Helper within useMemo to filter expenses consistent with total logic
    const getExpenseAmount = (txs) => {
        return txs
            .filter(t => {
                if (t.type !== 'expense') return false;
                if (t.expenseType === 'fixed') {
                    return isPaid(t.status);
                }
                return true;
            })
            .reduce((sum, t) => sum + t.amount, 0);
    };

    if (viewMode === 'weekly') {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            
            const dayTransactions = transactions.filter(t => {
                const tDate = getTransactionDate(t.date);
                return tDate.getDate() === d.getDate() && 
                       tDate.getMonth() === d.getMonth() &&
                       tDate.getFullYear() === d.getFullYear();
            });

            const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expense = getExpenseAmount(dayTransactions);
            
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
        // Last 4 weeks
        for (let i = 3; i >= 0; i--) {
            const end = new Date(today);
            end.setDate(end.getDate() - (i * 7));
            const start = new Date(end);
            start.setDate(start.getDate() - 6);
            
            const label = `${start.getDate()}/${start.getMonth()+1}`;

            const weekTransactions = transactions.filter(t => {
                const tDate = getTransactionDate(t.date);
                return tDate >= start && tDate <= end;
            });

            const income = weekTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expense = getExpenseAmount(weekTransactions);

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
                const tDate = getTransactionDate(t.date);
                return tDate.getMonth() === d.getMonth() && tDate.getFullYear() === d.getFullYear();
            });

            const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expense = getExpenseAmount(monthTransactions);

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
                {/* {(user?.email?.[0] || 'U').toUpperCase()} */}
                N
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
                
                <View className="items-center justify-center relative py-6">
                    <PieChart
                        data={stats.categories}
                        donut
                        radius={120}
                        innerRadius={104}
                        centerLabelComponent={() => {
                            return (
                                <View className="items-center justify-center">
                                    <Text className="text-gray-400 text-xs font-medium mb-1">Saldo Previsto</Text>
                                    <Text className="text-gray-900 text-2xl font-bold tracking-tight">
                                        {formatCurrency(stats.projectedBalance || 0)}
                                    </Text>
                                </View>
                            );
                        }}
                        roundedCorners
                        showValuesAsLabels={false}
                        showText={false}
                        strokeColor="#f9fafb"
                        strokeWidth={6}
                        focusOnPress
                        toggleFocusOnPress
                        shadow
                        shadowColor="rgba(0,0,0,0.1)"
                        shadowWidth={10}
                    />
                </View>

                {/* Legend */}
                <View className="flex-row justify-between w-full px-2 mt-8">
                    {stats.categories.map((cat, idx) => {
                        const total = stats.categories.reduce((sum, c) => sum + c.value, 0);
                        const percentage = total > 0 ? Math.round((cat.value / total) * 100) : 0;
                        
                        return (
                            <View key={idx} className="flex-col items-center flex-1">
                                <Text className="text-gray-500 text-[10px] mb-1 text-center" numberOfLines={1}>
                                    {cat.text}
                                </Text>
                                <Text className="text-gray-900 font-bold text-lg mb-1">
                                    {percentage}%
                                </Text>
                                {/* Progress bar */}
                                <View className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <View 
                                        style={{ 
                                            backgroundColor: cat.color, 
                                            height: '100%', 
                                            width: `${percentage}%`,
                                            borderRadius: 9999
                                        }} 
                                    />
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Card Grid */}
            <View className="space-y-4">
                <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-xl font-bold text-gray-900">Resumo Financeiro</Text>
                </View>
                
                {/* Row 1: Totals */}
                <View className="flex-row gap-3">
                    {/* Income */}
                    <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative">
                        <View className="absolute top-4 right-4 bg-blue-50 p-1.5 rounded-full">
                            <DollarSign size={16} color="#3B82F6" />
                        </View>
                        <Text className="text-gray-500 text-xs font-medium mb-1">Lucro Total</Text>
                        <Text className="text-emerald-500 text-lg font-bold mb-2">
                            {formatCurrency(stats.totalIncome)}
                        </Text>
                        <View className="bg-emerald-50 self-start px-2 py-0.5 rounded-full flex-row items-center gap-1">
                            <ArrowUpRight size={10} color="#10B981" />
                            <Text className="text-emerald-600 text-[10px] font-bold">Receitas</Text>
                        </View>
                    </View>

                    {/* Expense */}
                    <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative">
                        <View className="absolute top-4 right-4 bg-blue-50 p-1.5 rounded-full">
                            <DollarSign size={16} color="#3B82F6" />
                        </View>
                        <Text className="text-gray-500 text-xs font-medium mb-1">Despesas Totais</Text>
                        <Text className="text-red-500 text-lg font-bold mb-2">
                            {formatCurrency(stats.totalExpense)}
                        </Text>
                        <View className="bg-red-50 self-start px-2 py-0.5 rounded-full flex-row items-center gap-1">
                            <ArrowDownRight size={10} color="#EF4444" />
                            <Text className="text-red-600 text-[10px] font-bold">Gastos</Text>
                        </View>
                    </View>
                </View>

                {/* Net Profit (Full Width) */}
                <View className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative">
                    <View className="absolute top-4 right-4 bg-blue-50 p-1.5 rounded-full">
                        <Activity size={16} color="#3B82F6" />
                    </View>
                    <Text className="text-gray-500 text-xs font-medium mb-1">Lucro Líquido</Text>
                    <View className="items-center py-2">
                        <Text className="text-blue-600 text-3xl font-bold">
                            {formatCurrency(stats.netProfit)}
                        </Text>
                        <Text className="text-gray-400 text-xs mt-1">Saldo Atual</Text>
                    </View>
                </View>

                {/* Row 2: Status */}
                <View className="flex-row gap-3">
                    {/* Upcoming */}
                    <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative">
                        <View className="absolute top-4 right-4 bg-blue-50 p-1.5 rounded-full">
                            <Clock size={16} color="#3B82F6" />
                        </View>
                        <Text className="text-gray-500 text-xs font-medium mb-2">Despesas por Vir</Text>
                        <Text className="text-amber-600 text-lg font-bold mb-2 text-center">
                            {formatCurrency(stats.upcomingTotal)}
                        </Text>
                        <View className="bg-amber-50 self-center px-3 py-0.5 rounded-full">
                            <Text className="text-amber-600 text-[10px] font-bold">{stats.upcomingCount} pendentes</Text>
                        </View>
                    </View>

                    {/* Overdue */}
                    <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative">
                        <View className="absolute top-4 right-4 bg-blue-50 p-1.5 rounded-full">
                            <AlertCircle size={16} color="#3B82F6" />
                        </View>
                        <Text className="text-gray-500 text-xs font-medium mb-2">Despesas Atrasadas</Text>
                        <Text className="text-red-600 text-lg font-bold mb-2 text-center">
                            {formatCurrency(stats.overdueTotal)}
                        </Text>
                        <View className="bg-red-50 self-center px-3 py-0.5 rounded-full">
                            <Text className="text-red-600 text-[10px] font-bold">{stats.overdueCount} vencidas</Text>
                        </View>
                    </View>
                </View>

                {/* Paid Fixed (Full Width or Third in row?) - Design shows 3 cards in row 2 but on mobile 2 per row is better. Let's make this full width or split with something else? 
                   Actually, let's put Paid Fixed below or next to Overdue if we can fit 3? No, 3 is too small. 
                   Let's do a 2-col grid for everything.
                */}
                <View className="flex-row gap-3">
                     {/* Paid Fixed */}
                     <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative">
                        <View className="absolute top-4 right-4 bg-blue-50 p-1.5 rounded-full">
                            <CheckCircle size={16} color="#3B82F6" />
                        </View>
                        <Text className="text-gray-500 text-xs font-medium mb-2">Fixas Pagas</Text>
                        <Text className="text-emerald-600 text-lg font-bold mb-2 text-center">
                            {formatCurrency(stats.paidFixedTotal)}
                        </Text>
                        <View className="bg-emerald-50 self-center px-3 py-0.5 rounded-full">
                            <Text className="text-emerald-600 text-[10px] font-bold">{stats.paidFixedCount} pagas</Text>
                        </View>
                    </View>
                    
                    {/* Placeholder to balance grid or make Paid Fixed full width? Let's make it full width actually to break rhythm */}
                </View>
                
                {/* Row 3: Averages - Daily, Monthly, Yearly */}
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 py-2" contentContainerStyle={{ paddingHorizontal: 24 }}>
                    <View className="flex-row gap-4">
                        {/* Daily */}
                        <View className="w-[260px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-gray-900 font-bold">Média Diária</Text>
                                <View className="bg-blue-50 p-1.5 rounded-full">
                                    <Activity size={16} color="#3B82F6" />
                                </View>
                            </View>
                            <View className="space-y-2">
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-500 text-xs">Lucro</Text>
                                    <Text className="text-emerald-600 text-xs font-bold">{formatCurrency(stats.averages.daily.income)}</Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-500 text-xs">Despesa</Text>
                                    <Text className="text-red-600 text-xs font-bold">{formatCurrency(stats.averages.daily.expense)}</Text>
                                </View>
                                <View className="h-px bg-gray-100 my-1" />
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-900 text-xs font-bold">Saldo</Text>
                                    <Text className="text-blue-600 text-xs font-bold">{formatCurrency(stats.averages.daily.profit)}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Monthly */}
                        <View className="w-[260px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-gray-900 font-bold">Média Mensal</Text>
                                <View className="bg-blue-50 p-1.5 rounded-full">
                                    <Calendar size={16} color="#3B82F6" />
                                </View>
                            </View>
                            <View className="space-y-2">
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-500 text-xs">Lucro</Text>
                                    <Text className="text-emerald-600 text-xs font-bold">{formatCurrency(stats.averages.monthly.income)}</Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-500 text-xs">Despesa</Text>
                                    <Text className="text-red-600 text-xs font-bold">{formatCurrency(stats.averages.monthly.expense)}</Text>
                                </View>
                                <View className="h-px bg-gray-100 my-1" />
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-900 text-xs font-bold">Saldo</Text>
                                    <Text className="text-blue-600 text-xs font-bold">{formatCurrency(stats.averages.monthly.profit)}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Yearly */}
                        <View className="w-[260px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-gray-900 font-bold">Média Anual</Text>
                                <View className="bg-blue-50 p-1.5 rounded-full">
                                    <Calendar size={16} color="#3B82F6" />
                                </View>
                            </View>
                            <View className="space-y-2">
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-500 text-xs">Lucro</Text>
                                    <Text className="text-emerald-600 text-xs font-bold">{formatCurrency(stats.averages.yearly.income)}</Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-500 text-xs">Despesa</Text>
                                    <Text className="text-red-600 text-xs font-bold">{formatCurrency(stats.averages.yearly.expense)}</Text>
                                </View>
                                <View className="h-px bg-gray-100 my-1" />
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-900 text-xs font-bold">Saldo</Text>
                                    <Text className="text-blue-600 text-xs font-bold">{formatCurrency(stats.averages.yearly.profit)}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>

                {/* Row 4: Business Logic (Patients, etc) - Mocked */}
                <View className="flex-row gap-3">
                     {/* Patients */}
                     <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative justify-between">
                        <View className="flex-row justify-between items-start mb-2">
                            <Text className="text-gray-500 text-xs font-medium">Pacientes</Text>
                            <View className="bg-blue-50 p-1.5 rounded-full">
                                <Users size={16} color="#3B82F6" />
                            </View>
                        </View>
                        <View className="items-center mb-2">
                            <Text className="text-gray-900 text-3xl font-bold">268</Text>
                            <Text className="text-gray-400 text-[10px]">Total</Text>
                        </View>
                        <View className="flex-row justify-between items-end">
                            <Text className="text-emerald-500 text-[10px] font-bold">+12 novos</Text>
                            <Text className="text-emerald-500 text-[10px] font-bold">~43%</Text>
                        </View>
                    </View>

                    {/* Statement Types */}
                    <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative">
                         <View className="flex-row justify-between items-start mb-2">
                            <Text className="text-gray-500 text-xs font-medium">Extratos</Text>
                            <View className="bg-blue-50 p-1.5 rounded-full">
                                <Activity size={16} color="#3B82F6" />
                            </View>
                        </View>
                        <View className="flex-row justify-between mt-2">
                             <View className="items-center">
                                <Activity size={12} color="#3B82F6" className="mb-1" />
                                <Text className="text-gray-900 font-bold text-lg">2</Text>
                                <Text className="text-gray-400 text-[8px]">Obrigatórios</Text>
                             </View>
                             <View className="w-px bg-gray-100 h-full mx-1" />
                             <View className="items-center">
                                <Clock size={12} color="#F59E0B" className="mb-1" />
                                <Text className="text-gray-900 font-bold text-lg">1</Text>
                                <Text className="text-gray-400 text-[8px]">Variáveis</Text>
                             </View>
                        </View>
                    </View>
                </View>

                 {/* Exams (Mocked Donut) */}
                 <View className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative flex-row items-center">
                    <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-2">
                             <Text className="text-gray-500 text-xs font-medium">Exames por Convênios</Text>
                             <View className="bg-blue-50 p-1.5 rounded-full">
                                <Users size={16} color="#3B82F6" />
                            </View>
                        </View>
                        <View className="flex-row items-center mt-2">
                            <View className="h-2 w-2 rounded-full bg-blue-600 mr-2" />
                            <Text className="text-gray-700 text-xs">1 Pix</Text>
                        </View>
                    </View>
                    <View className="h-16 w-16 items-center justify-center relative">
                        {/* Simple CSS/View Circle for mock */}
                        <View className="absolute w-16 h-16 rounded-full border-[6px] border-blue-600 opacity-20" />
                        <View className="absolute w-16 h-16 rounded-full border-[6px] border-blue-600 border-l-transparent border-b-transparent rotate-45" />
                        <Text className="font-bold text-gray-900">1</Text>
                    </View>
                </View>

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