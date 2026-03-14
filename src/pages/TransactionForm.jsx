import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { transactionService } from '../services/transactionService';
import { Input } from '../components/atoms/Input';
import { Button } from '../components/atoms/Button';
import { X, Calendar } from 'lucide-react-native';

export function TransactionForm({ navigation, route }) {
  const { user } = useAuth();
  const { initialType, initialExpenseType, transaction } = route.params || {};
  const isEditing = !!transaction;

  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(transaction?.type || initialType || 'income'); // income, expense
  const [description, setDescription] = useState(transaction?.description || '');
  const [amount, setAmount] = useState(transaction?.amount ? transaction.amount.toString() : '');
  
  // Date handling: transaction.date might be YYYY-MM-DD or DD/MM/YYYY depending on where it came from?
  // In the web app, we saw inconsistent formats. Let's assume standardized or handle both.
  // Actually, transactionService returns standard format usually.
  // Let's safe init date.
  const initDate = () => {
      if (transaction?.date) {
          if (transaction.date.includes('/')) {
             const [day, month, year] = transaction.date.split('/');
             return `${year}-${month}-${day}`;
          }
          return transaction.date;
      }
      return new Date().toISOString().split('T')[0];
  };

  const [date, setDate] = useState(initDate());
  const [paymentMethod, setPaymentMethod] = useState(transaction?.paymentMethod || transaction?.payment_method || 'pix');

  // Income specific
  const [isBakeryIncome, setIsBakeryIncome] = useState(transaction?.isBakeryIncome || transaction?.is_bakery_income || false);
  const [clientName, setClientName] = useState(transaction?.clientName || transaction?.client_name || '');

  // Expense specific
  const [expenseType, setExpenseType] = useState(transaction?.expenseType || transaction?.expense_type || initialExpenseType || 'fixed'); // fixed, variable
  const [recurrence, setRecurrence] = useState(transaction?.recurrence || 'monthly');
  const [interestRate, setInterestRate] = useState(transaction?.interestRate ? transaction.interestRate.toString() : '');
  const [isActive, setIsActive] = useState(transaction?.active !== false); // Default true
  const [endDate, setEndDate] = useState(transaction?.end_date || ''); // New state for end date
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const d = String(selectedDate.getDate()).padStart(2, '0');
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const y = selectedDate.getFullYear();
      setDate(`${y}-${m}-${d}`);
    }
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      const d = String(selectedDate.getDate()).padStart(2, '0');
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const y = selectedDate.getFullYear();
      setEndDate(`${y}-${m}-${d}`);
    }
  };

  const formatDateDisplay = (isoDate) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleSubmit = async () => {
    if (!description || !amount || !date) {
      Alert.alert('Erro', 'Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const [year, month, day] = date.split('-');
      const timestamp = new Date(year, month - 1, day).getTime();

      const transactionData = {
        description,
        amount: parseFloat(amount.replace(',', '.')),
        type,
        payment_method: paymentMethod,
        date: date, // Keep YYYY-MM-DD format for database
        user_id: user.id,
        is_bakery_income: type === 'income' ? isBakeryIncome : false,
        client_name: type === 'income' && isBakeryIncome ? clientName : null,
        expense_type: type === 'expense' ? expenseType : null,
        recurrence: type === 'expense' && expenseType === 'fixed' ? recurrence : null,
        interest_rate: type === 'expense' && expenseType === 'fixed' && interestRate ? parseFloat(interestRate.replace(',', '.')) : null,
        active: type === 'expense' && expenseType === 'fixed' ? isActive : null,
        end_date: type === 'expense' && expenseType === 'fixed' && !isActive ? endDate : null
      };

      if (isEditing) {
          // Check if it's a virtual transaction (ID starts with 'virtual-')
          const isVirtual = transaction.id && transaction.id.toString().startsWith('virtual-');

          if (isVirtual) {
               // If virtual, we CREATE a new transaction instead of updating
               // Remove ID so database generates a new UUID
               // Ensure user_id is set
               const { id, ...newTransactionData } = {
                   ...transactionData,
                   user_id: user.id
               };
               
               await transactionService.create(newTransactionData);

               // If finalizing, propagate to related transactions
               if (type === 'expense' && expenseType === 'fixed') {
                   if (!isActive) {
                        await transactionService.finalizeRecurrence(user.id, description, endDate);
                   } else {
                        await transactionService.reactivateRecurrence(user.id, description);
                   }
               }

               Alert.alert('Sucesso', 'Transação criada com sucesso!');
          } else {
              await transactionService.update(transaction.id, transactionData);

              // If finalizing, propagate to related transactions
               if (type === 'expense' && expenseType === 'fixed') {
                   if (!isActive) {
                        await transactionService.finalizeRecurrence(user.id, description, endDate);
                   } else {
                        await transactionService.reactivateRecurrence(user.id, description);
                   }
               }

              Alert.alert('Sucesso', 'Transação atualizada com sucesso!');
          }
      } else {
          await transactionService.create(transactionData);

          // If finalizing, propagate to related transactions
           if (type === 'expense' && expenseType === 'fixed') {
               if (!isActive) {
                    await transactionService.finalizeRecurrence(user.id, description, endDate);
               } else {
                    await transactionService.reactivateRecurrence(user.id, description);
               }
           }

          Alert.alert('Sucesso', 'Transação criada com sucesso!');
      }
      
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível salvar a transação.');
    } finally {
      setLoading(false);
    }
  };

  const TabButton = ({ label, value, current, onPress }) => (
    <TouchableOpacity
      onPress={() => onPress(value)}
      className={`flex-1 py-3 items-center justify-center rounded-xl ${
        current === value 
          ? (value === 'income' ? 'bg-emerald-100' : 'bg-red-100') 
          : 'bg-gray-100'
      }`}
    >
      <Text className={`font-bold ${
        current === value 
          ? (value === 'income' ? 'text-emerald-700' : 'text-red-700') 
          : 'text-gray-500'
      }`}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row justify-between items-center px-6 py-4 border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">Nova Transação</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6 py-4">
          {/* Type Selector */}
          <View className="flex-row gap-4 mb-6">
            <TabButton 
              label="Entrada" 
              value="income" 
              current={type} 
              onPress={setType} 
            />
            <TabButton 
              label="Saída" 
              value="expense" 
              current={type} 
              onPress={setType} 
            />
          </View>

          <Input
            label="Descrição"
            placeholder="Ex: Pagamento Cliente X"
            value={description}
            onChangeText={setDescription}
          />

          <Input
            label="Valor (R$)"
            placeholder="0,00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <TouchableOpacity onPress={() => setShowDatePicker(true)} className="mb-4">
            <View pointerEvents="none">
              <Input
                label="Data"
                placeholder="DD/MM/AAAA"
                value={formatDateDisplay(date)}
                editable={false}
                rightElement={<Calendar size={20} color="#9CA3AF" />}
              />
            </View>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={new Date(date.split('-')[0], date.split('-')[1] - 1, date.split('-')[2])}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}

          {/* Payment Method */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Método de Pagamento</Text>
            <View className="flex-row gap-2">
              {['pix', 'cartao', 'dinheiro'].map((method) => (
                <TouchableOpacity
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  className={`px-4 py-2 rounded-lg border ${
                    paymentMethod === method 
                      ? 'bg-purple-50 border-[#7E1A8B]' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={paymentMethod === method ? 'text-[#7E1A8B] font-medium' : 'text-gray-600'}>
                    {method === 'pix' ? 'Pix' : method === 'cartao' ? 'Cartão' : 'Dinheiro'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Conditional Fields */}
          {type === 'income' && (
            <View className="bg-gray-50 p-4 rounded-xl mb-4">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-gray-700 font-medium">Receita da Padaria?</Text>
                <Switch 
                  value={isBakeryIncome} 
                  onValueChange={setIsBakeryIncome}
                  trackColor={{ false: "#D1D5DB", true: "#7E1A8B" }}
                />
              </View>
              
              {isBakeryIncome && (
                <Input
                  label="Nome do Cliente"
                  placeholder="Nome do cliente"
                  value={clientName}
                  onChangeText={setClientName}
                />
              )}
            </View>
          )}

          {type === 'expense' && (
            <View className="bg-gray-50 p-4 rounded-xl mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Tipo de Despesa</Text>
              <View className="flex-row gap-2 mb-4">
                <TouchableOpacity
                  onPress={() => setExpenseType('fixed')}
                  className={`flex-1 py-2 items-center rounded-lg border ${
                    expenseType === 'fixed' ? 'bg-white border-[#7E1A8B]' : 'bg-transparent border-gray-200'
                  }`}
                >
                  <Text>Fixa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setExpenseType('variable')}
                  className={`flex-1 py-2 items-center rounded-lg border ${
                    expenseType === 'variable' ? 'bg-white border-[#7E1A8B]' : 'bg-transparent border-gray-200'
                  }`}
                >
                  <Text>Variável</Text>
                </TouchableOpacity>
              </View>

              {expenseType === 'fixed' && (
                <>
                  <View className="mb-4">
                    <Text className="text-sm font-medium text-gray-700 mb-2">Recorrência</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {['monthly', 'daily', 'weekly', 'quarterly', 'annual'].map((r) => (
                        <TouchableOpacity
                          key={r}
                          onPress={() => setRecurrence(r)}
                          className={`px-3 py-1.5 rounded-lg border ${
                            recurrence === r
                              ? 'bg-purple-50 border-[#7E1A8B]'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <Text className={recurrence === r ? 'text-[#7E1A8B]' : 'text-gray-600'}>
                            {r === 'monthly' ? 'Mensal' : 
                             r === 'daily' ? 'Diária' : 
                             r === 'weekly' ? 'Semanal' :
                             r === 'quarterly' ? 'Trimestral' : 'Anual'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <Input
                    label="Taxa de Juros (%)"
                    placeholder="0"
                    value={interestRate}
                    onChangeText={setInterestRate}
                    keyboardType="numeric"
                  />

                  <View className="flex-row justify-between items-center bg-white p-3 rounded-lg border border-gray-200 mb-4">
                    <Text className="text-gray-700 font-medium">Despesa Finalizada</Text>
                    <Switch 
                      value={!isActive} 
                      onValueChange={(val) => {
                          setIsActive(!val);
                          if (val) {
                              setEndDate(new Date().toISOString().split('T')[0]);
                          } else {
                              setEndDate('');
                          }
                      }}
                      trackColor={{ false: "#D1D5DB", true: "#EF4444" }}
                    />
                  </View>

                  {!isActive && (
                    <View className="bg-red-50 p-3 rounded-lg border border-red-100 mb-4">
                        <TouchableOpacity onPress={() => setShowEndDatePicker(true)}>
                            <View pointerEvents="none">
                                <Input
                                    label="Data de Finalização"
                                    placeholder="DD/MM/AAAA"
                                    value={formatDateDisplay(endDate)}
                                    editable={false}
                                    rightElement={<Calendar size={20} color="#DC2626" />}
                                />
                            </View>
                        </TouchableOpacity>

                        {showEndDatePicker && (
                            <DateTimePicker
                                value={endDate ? new Date(endDate.split('-')[0], endDate.split('-')[1] - 1, endDate.split('-')[2]) : new Date()}
                                mode="date"
                                display="default"
                                onChange={onEndDateChange}
                            />
                        )}

                        <Text className="text-xs text-red-600 mt-1">
                            A partir desta data, não serão geradas novas cobranças.
                        </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          <Button 
            title="Salvar Transação" 
            onPress={handleSubmit} 
            loading={loading}
            className="mb-8"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}