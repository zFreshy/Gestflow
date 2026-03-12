import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { transactionService } from '../services/transactionService';
import { Input } from '../components/atoms/Input';
import { Button } from '../components/atoms/Button';
import { X, Calendar } from 'lucide-react-native';

export function TransactionForm({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('income'); // income, expense
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('pix');

  // Income specific
  const [isBakeryIncome, setIsBakeryIncome] = useState(false);
  const [clientName, setClientName] = useState('');

  // Expense specific
  const [expenseType, setExpenseType] = useState('fixed'); // fixed, variable
  const [recurrence, setRecurrence] = useState('monthly');
  const [interestRate, setInterestRate] = useState('');

  const handleSubmit = async () => {
    if (!description || !amount || !date) {
      Alert.alert('Erro', 'Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const [year, month, day] = date.split('-');
      const timestamp = new Date(year, month - 1, day).getTime();

      const transaction = {
        description,
        amount: parseFloat(amount.replace(',', '.')),
        type,
        paymentMethod,
        date: `${day}/${month}/${year}`,
        timestamp,
        user_id: user.id,
        isBakeryIncome: type === 'income' ? isBakeryIncome : false,
        clientName: type === 'income' && isBakeryIncome ? clientName : null,
        expenseType: type === 'expense' ? expenseType : null,
        recurrence: type === 'expense' && expenseType === 'fixed' ? recurrence : null,
        interestRate: type === 'expense' && expenseType === 'fixed' && interestRate ? parseFloat(interestRate) : null,
      };

      await transactionService.create(transaction);
      Alert.alert('Sucesso', 'Transação criada com sucesso!');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível criar a transação.');
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

          <Input
            label="Data (AAAA-MM-DD)"
            placeholder="2023-10-25"
            value={date}
            onChangeText={setDate}
          />

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
                  <Input
                    label="Taxa de Juros (%)"
                    placeholder="0"
                    value={interestRate}
                    onChangeText={setInterestRate}
                    keyboardType="numeric"
                  />
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