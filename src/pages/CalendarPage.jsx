import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useAuth } from '../contexts/AuthContext';
import { transactionService } from '../services/transactionService';
import { TransactionItem } from '../components/molecules/TransactionItem';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

// Configure Locale to Portuguese
LocaleConfig.locales['pt-br'] = {
  monthNames: [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt-br';

export function CalendarPage({ navigation }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Initialize with local date string YYYY-MM-DD
  const getTodayString = () => {
    const date = new Date();
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${y}-${m}-${d}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await transactionService.getAll(user.id, 0, 50, true);
      
      let dataToMap = [];
      if (Array.isArray(response)) {
          dataToMap = response;
      } else if (response && Array.isArray(response.data)) {
          dataToMap = response.data;
      }

      // Map Supabase snake_case to camelCase
      const mappedData = dataToMap.map(t => ({
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

  // Helper to parse date string (YYYY-MM-DD or DD/MM/YYYY) to Local Date object
  const parseDate = (dateStr) => {
    if (!dateStr) return new Date();
    
    // Handle YYYY-MM-DD (Supabase default)
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return new Date(year, month - 1, day);
    }
    
    // Handle DD/MM/YYYY (Legacy/Web format)
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      return new Date(year, month - 1, day);
    }
    
    return new Date();
  };

  // Normalize any date input to YYYY-MM-DD string
  const normalizeDateKey = (input) => {
    if (!input) return '';
    
    // If it's a Date object
    if (input instanceof Date) {
        const d = String(input.getDate()).padStart(2, '0');
        const m = String(input.getMonth() + 1).padStart(2, '0');
        const y = input.getFullYear();
        return `${y}-${m}-${d}`;
    }

    // If it's a string
    const dateStr = String(input);
    
    // Handle YYYY-MM-DD
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
    }
    
    // Handle DD/MM/YYYY
    if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month}-${day}`;
    }

    // Fallback: try parsing as Date
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${year}-${month}-${day}`;
    }

    return dateStr;
  };

  // Format YYYY-MM-DD string to DD/MM/YYYY for display
  const formatDateForDisplay = (dateKey) => {
    if (!dateKey) return '';
    const parts = dateKey.split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    }
    return dateKey;
  };

  // Generate virtual transactions for recurring expenses
  const allTransactions = useMemo(() => {
    if (loading) return [];

    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Get base fixed expenses
    const fixedExpenses = transactions.filter(t => t.type === 'expense' && t.expenseType === 'fixed');
    
    // 2. Group to find latest occurrence (logic from web)
    const recurringGroups = {};
    fixedExpenses.forEach(t => {
        if (t.recurrence) {
            const key = `${t.description}-${t.amount}-${t.recurrence}`;
            // Use normalizeDateKey for comparison
            const currentGroupDate = recurringGroups[key] ? normalizeDateKey(recurringGroups[key].date) : '';
            const thisDate = normalizeDateKey(t.date);
            
            if (!recurringGroups[key] || currentGroupDate < thisDate) {
                recurringGroups[key] = t;
            }
        }
    });

    const virtuals = [];
    
    Object.values(recurringGroups).forEach(baseTransaction => {
        const lastDate = parseDate(baseTransaction.date);
        let nextDate = new Date(lastDate);
        
        // Calculate next occurrence
        switch (baseTransaction.recurrence?.toLowerCase()) {
            case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
            case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
            case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
            case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
            case 'semiannual': nextDate.setMonth(nextDate.getMonth() + 6); break;
            case 'annual': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
        }

        // Generate occurrences until end of current month
        while (nextDate <= endOfMonth) {
            if (nextDate >= startOfMonth) {
                // Check if this specific occurrence already exists
                const exists = fixedExpenses.some(t => 
                    t.description === baseTransaction.description && 
                    t.amount === baseTransaction.amount &&
                    parseDate(t.date).getTime() === nextDate.getTime()
                );

                if (!exists) {
                    virtuals.push({
                        ...baseTransaction,
                        id: `virtual-${baseTransaction.id}-${nextDate.getTime()}`,
                        date: normalizeDateKey(nextDate), // Ensure consistent format
                        isVirtual: true,
                        status: 'Pendente'
                    });
                }
            }

            // Advance to next
            switch (baseTransaction.recurrence?.toLowerCase()) {
                case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
                case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
                case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
                case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
                case 'semiannual': nextDate.setMonth(nextDate.getMonth() + 6); break;
                case 'annual': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
                default: nextDate = new Date(endOfMonth.getTime() + 1000); // Break loop
            }
        }
    });

    return [...transactions, ...virtuals];
  }, [transactions, currentMonth, loading]);

  // Generate marked dates for calendar
  const markedDates = useMemo(() => {
    const marks = {};
    
    allTransactions.forEach(t => {
      const key = normalizeDateKey(t.date);
      
      if (!marks[key]) {
        marks[key] = {
          dots: [],
          marked: true
        };
      }

      // Add dot if not already present (limit to 3 dots for visual clarity)
      if (marks[key].dots.length < 3) {
        const color = t.type === 'income' ? '#10B981' : (t.isVirtual ? '#D97706' : '#EF4444');
        // Avoid duplicate colors for same day if possible, or just push
        marks[key].dots.push({ color });
      }
    });

    // Add selected date style
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: '#7E1A8B',
      selectedTextColor: '#FFFFFF'
    };

    return marks;
  }, [allTransactions, selectedDate]);

  // Filter transactions for selected date
  const selectedDateTransactions = useMemo(() => {
    return allTransactions.filter(t => {
        // Normalize everything to YYYY-MM-DD strings for comparison
        const tDateKey = normalizeDateKey(t.date);
        return tDateKey === selectedDate;
    });
  }, [allTransactions, selectedDate]);

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const handleMonthChange = (month) => {
    // month is { year, month, timestamp, dateString }
    // month.month is 1-12
    setCurrentMonth(new Date(month.year, month.month - 1, 1));
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#7E1A8B" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white pb-4 shadow-sm z-10">
        <View className="flex-row items-center justify-between px-4 py-3">
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="p-2 -ml-2 rounded-full active:bg-gray-100"
          >
            <ChevronLeft size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900">Calendário</Text>
          <View className="w-10" />
        </View>

        <Calendar
          current={selectedDate}
          onDayPress={handleDayPress}
          onMonthChange={handleMonthChange}
          markedDates={markedDates}
          markingType={'multi-dot'}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#b6c1cd',
            selectedDayBackgroundColor: '#7E1A8B',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#7E1A8B',
            dayTextColor: '#2d4150',
            textDisabledColor: '#d9e1e8',
            dotColor: '#00adf5',
            selectedDotColor: '#ffffff',
            arrowColor: '#7E1A8B',
            monthTextColor: '#7E1A8B',
            indicatorColor: '#7E1A8B',
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 14
          }}
        />
      </View>

      <View className="flex-1 px-4 pt-4">
        <Text className="text-base font-semibold text-gray-900 mb-3">
            Transações em {formatDateForDisplay(selectedDate)}
        </Text>
        
        {selectedDateTransactions.length === 0 ? (
            <View className="flex-1 items-center justify-center opacity-50">
                <Text className="text-gray-500">Nenhuma transação neste dia</Text>
            </View>
        ) : (
            <FlatList
                data={selectedDateTransactions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <TransactionItem 
                        transaction={item} 
                        onEdit={() => navigation.navigate('AddTransaction', { transaction: item })}
                        onDelete={() => handleDelete(item)}
                    />
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
            />
        )}
      </View>
    </SafeAreaView>
  );
}
