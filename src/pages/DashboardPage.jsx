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

        let currentDate = new Date(lastDate);
        
        // Advance to next occurrence initially
        switch (lastExpense.recurrence?.toLowerCase()) {
            case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
            case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
            case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
            case 'quarterly': currentDate.setMonth(currentDate.getMonth() + 3); break;
            case 'semiannual': currentDate.setMonth(currentDate.getMonth() + 6); break;
            case 'annual': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
            case 'biennial': currentDate.setFullYear(currentDate.getFullYear() + 2); break;
            default: currentDate.setMonth(currentDate.getMonth() + 1);
        }

        // Generate all missing occurrences up to the first future one
        let safetyCounter = 0;
        while (safetyCounter < 60) {
            const isOverdue = currentDate < today;
            
            virtualExpenses.push({
                ...lastExpense,
                id: `virtual-${lastExpense.id}-${currentDate.getTime()}`,
                date: currentDate.toLocaleDateString('pt-BR'),
                status: isOverdue ? 'Atrasado' : 'Aguardando',
                isVirtual: true,
                isOverdue: isOverdue
            });

            // If we just added a future occurrence, we stop
            if (!isOverdue) break;

            // Advance to next occurrence
            switch (lastExpense.recurrence?.toLowerCase()) {
                case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
                case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
                case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
                case 'quarterly': currentDate.setMonth(currentDate.getMonth() + 3); break;
                case 'semiannual': currentDate.setMonth(currentDate.getMonth() + 6); break;
                case 'annual': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
                case 'biennial': currentDate.setFullYear(currentDate.getFullYear() + 2); break;
                default: currentDate.setMonth(currentDate.getMonth() + 1);
            }
            safetyCounter++;
        }
    });

    // 4. Metrics
    const realUpcoming = fixedExpenses.filter(t => isPending(t.status) && getTransactionDate(t.date) >= today);
    const virtualUpcoming = virtualExpenses.filter(t => !t.isOverdue);
    const upcomingExpenses = [...realUpcoming, ...virtualUpcoming];
    
    // Filter upcoming expenses up to the end of the next month
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 2);
    nextMonth.setDate(0); // Last day of next month
    
    const filteredUpcoming = upcomingExpenses.filter(t => getTransactionDate(t.date) <= nextMonth);
    const filteredUpcomingTotal = filteredUpcoming.reduce((acc, t) => acc + t.amount, 0);

    const realOverdue = fixedExpenses.filter(t => isPending(t.status) && getTransactionDate(t.date) < today);
    const virtualOverdue = virtualExpenses.filter(t => t.isOverdue);
    const overdueExpenses = [...realOverdue, ...virtualOverdue];

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

    // 6. Period Totals (User requested "Totals" for these periods, despite "Média" label)
    const todayStr = today.toLocaleDateString('pt-BR');
    const currentMonthStr = `${today.getMonth() + 1}/${today.getFullYear()}`;
    const currentYear = today.getFullYear();

    // Daily: Today
    const dailyTxs = data.filter(t => {
        const d = getTransactionDate(t.date);
        return d.toLocaleDateString('pt-BR') === todayStr;
    });
    
    // Monthly: Current Month
    const monthlyTxs = data.filter(t => {
        const d = getTransactionDate(t.date);
        return (d.getMonth() + 1) === (today.getMonth() + 1) && d.getFullYear() === currentYear;
    });

    // Yearly: Current Year
    const yearlyTxs = data.filter(t => {
        const d = getTransactionDate(t.date);
        return d.getFullYear() === currentYear;
    });

    const calculateStats = (txs) => {
        const inc = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const exp = txs.filter(t => {
            if (t.type !== 'expense') return false;
            if (t.expenseType === 'fixed') return isPaid(t.status);
            return true;
        }).reduce((acc, t) => acc + t.amount, 0);
        return { income: inc, expense: exp, profit: inc - exp };
    };

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
        daily: calculateStats(dailyTxs),
        monthly: calculateStats(monthlyTxs),
        yearly: calculateStats(yearlyTxs)
      }
    });
  };

  const [selectedBarIndex, setSelectedBarIndex] = useState(null);

  const barChartData = useMemo(() => {
    if (!transactions.length) return [];
    
    const today = new Date();
    let rawData = [];
    
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
            const profit = income - expense;

            rawData.push({
                value: profit,
                label: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()],
                originalValue: profit,
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
            const profit = income - expense;

            rawData.push({
                value: profit,
                label,
                originalValue: profit,
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
            const profit = income - expense;

            rawData.push({
                value: profit,
                label: monthName,
                originalValue: profit,
            });
        }
    }

    // Determine max value for the "Track" height
    const dataMax = Math.max(...rawData.map(d => Math.abs(d.value)), 0);
    // User requested "indo até 30000". We ensure it's at least 30000, or higher if data demands.
    // Also ensuring reasonable steps (3 sections).
    const maxValue = Math.max(dataMax * 1.1, 30000);
    const activeIndex = selectedBarIndex === null ? rawData.length - 1 : selectedBarIndex;

    return rawData.map((item, index) => {
        const isSelected = index === activeIndex;
        const absValue = Math.abs(item.value);
        const isPositive = item.value >= 0;
        const chartHeight = 200;
        
        let fillColor;
        if (isSelected) {
            fillColor = '#F472B6'; // Pink-400
        } else {
            fillColor = isPositive ? '#10B981' : '#EF4444'; // Emerald or Red
        }

        return {
            value: absValue, // Value for the bar
            frontColor: fillColor,
            label: item.label,
            topLabelComponent: isSelected ? () => (
                <View style={{ marginBottom: 6, alignItems: 'center' }}>
                    <View style={{
                        backgroundColor: 'white',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        minWidth: 80,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#000',
                        shadowOffset: {width: 0, height: 2},
                        shadowOpacity: 0.15,
                        shadowRadius: 3,
                        elevation: 4,
                    }}>
                        <Text style={{ fontSize: 12, color: '#F472B6', fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
                            {formatCurrency(item.originalValue || 0)}
                        </Text>
                    </View>
                    <View style={{
                        width: 0,
                        height: 0,
                        backgroundColor: 'transparent',
                        borderStyle: 'solid',
                        borderLeftWidth: 6,
                        borderRightWidth: 6,
                        borderBottomWidth: 0,
                        borderTopWidth: 6,
                        borderLeftColor: 'transparent',
                        borderRightColor: 'transparent',
                        borderTopColor: 'white',
                        alignSelf: 'center',
                    }} />
                </View>
            ) : undefined,
            
            stacks: [
                {
                    value: absValue,
                    color: fillColor,
                    borderBottomLeftRadius: 16,
                    borderBottomRightRadius: 16,
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    marginBottom: 0,
                },
                {
                    value: maxValue - absValue,
                    color: '#F3F4F6', // Gray-100 (Light track)
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                }
            ],
            
            spacing: 24,
            labelTextStyle: { color: isSelected ? '#F472B6' : '#9CA3AF', fontWeight: isSelected ? 'bold' : 'normal' },
        };
     });
    
  }, [transactions, viewMode, selectedBarIndex]);

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
                            <Text className="text-gray-500 text-xs font-medium">Clientes</Text>
                            <View className="bg-blue-50 p-1.5 rounded-full">
                                <Users size={16} color="#3B82F6" />
                            </View>
                        </View>
                        <View className="items-center mb-2">
                            <Text className="text-gray-900 text-3xl font-bold">0</Text>
                            <Text className="text-gray-400 text-[10px]">Total</Text>
                        </View>
                    </View>

                    {/* Statement Types */}
                    <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative">
                         <View className="flex-row justify-between items-start mb-2">
                            <Text className="text-gray-500 text-xs font-medium">Tipos de Extratos</Text>
                            <View className="bg-blue-50 p-1.5 rounded-full">
                                <Activity size={16} color="#3B82F6" />
                            </View>
                        </View>
                        <View className="flex-row justify-between mt-2">
                             <View className="items-center">
                                <Activity size={12} color="#3B82F6" className="mb-1" />
                                <Text className="text-gray-900 font-bold text-lg">
                                    {stats.paidFixedCount}
                                </Text>
                                <Text className="text-gray-400 text-[8px]">Obrigatórios</Text>
                                <Text className="text-gray-500 text-[8px] font-bold mt-1">
                                    {formatCurrency(stats.paidFixedTotal)}
                                </Text>
                             </View>
                             <View className="w-px bg-gray-100 h-full mx-1" />
                             <View className="items-center">
                                <Clock size={12} color="#F59E0B" className="mb-1" />
                                <Text className="text-gray-900 font-bold text-lg">
                                    {transactions.filter(t => t.type === 'expense' && t.expenseType === 'variable').length}
                                </Text>
                                <Text className="text-gray-400 text-[8px]">Variáveis</Text>
                                <Text className="text-gray-500 text-[8px] font-bold mt-1">
                                    {formatCurrency(transactions.filter(t => t.type === 'expense' && t.expenseType === 'variable').reduce((acc, t) => acc + t.amount, 0))}
                                </Text>
                             </View>
                        </View>
                    </View>
                </View>

                 {/* Exams (Payment Methods) */}
                 <View className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative flex-row items-center">
                    <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-2">
                             <Text className="text-gray-500 text-xs font-medium">Vendas por Convênios</Text>
                             <View className="bg-blue-50 p-1.5 rounded-full">
                                <Users size={16} color="#3B82F6" />
                            </View>
                        </View>
                        
                        {/* Dynamic Legend based on Payment Methods */}
                        <View className="mt-2 space-y-1">
                            {Object.entries(
                                transactions
                                    .filter(t => t.type === 'income')
                                    .reduce((acc, t) => {
                                        const method = t.paymentMethod || 'Outros';
                                        acc[method] = (acc[method] || 0) + 1;
                                        return acc;
                                    }, {})
                            ).slice(0, 3).map(([method, count], idx) => (
                                <View key={idx} className="flex-row items-center">
                                    <View className={`h-2 w-2 rounded-full mr-2`} style={{ backgroundColor: ['#2563EB', '#10B981', '#F59E0B', '#EF4444'][idx % 4] }} />
                                    <Text className="text-gray-700 text-xs capitalize">{count} {method}</Text>
                                </View>
                            ))}
                            {transactions.filter(t => t.type === 'income').length === 0 && (
                                <Text className="text-gray-400 text-xs">Sem dados</Text>
                            )}
                        </View>
                    </View>
                    
                    <View className="h-20 w-20 items-center justify-center relative">
                         <PieChart
                            data={
                                Object.entries(
                                    transactions
                                        .filter(t => t.type === 'income')
                                        .reduce((acc, t) => {
                                            const method = t.paymentMethod || 'Outros';
                                            acc[method] = (acc[method] || 0) + 1;
                                            return acc;
                                        }, {})
                                ).map(([method, count], idx) => ({
                                    value: count,
                                    color: ['#2563EB', '#10B981', '#F59E0B', '#EF4444'][idx % 4],
                                    text: method
                                }))
                            }
                            donut
                            radius={32}
                            innerRadius={24}
                            showText={false}
                            centerLabelComponent={() => {
                                return (
                                    <Text className="text-gray-900 font-bold text-xs">
                                        {transactions.filter(t => t.type === 'income').length}
                                    </Text>
                                );
                            }}
                        />
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
                <View className="items-center">
                     <BarChart
                        stackData={barChartData}
                        barWidth={24} // Reduced from 32 to fit 7 items
                        spacing={20}  // Reduced from 24 to fit 7 items
                        hideRules
                        xAxisThickness={0}
                        yAxisThickness={0}
                        yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
                        noOfSections={3}
                        maxValue={barChartData.length > 0 ? barChartData[0].maxValue : 30000}
                        width={screenWidth - 60} // Adjusted width
                        height={200}
                        isAnimated
                        onPress={(item, index) => setSelectedBarIndex(index)}
                        // Extra props for clipping/labels
                        yAxisExtraHeight={40}
                        // Custom formatting for Y-axis (compact numbers)
                        formatYLabel={(label) => {
                            const val = parseFloat(label);
                            if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                            return label;
                        }}
                    />
                </View>
            </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}