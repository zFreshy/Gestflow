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
      // Return local date YYYY-MM-DD
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(initDate());
  const [paymentMethod, setPaymentMethod] = useState(transaction?.paymentMethod || transaction?.payment_method || 'pix');

  // Income specific
  const [isBakeryIncome, setIsBakeryIncome] = useState(transaction?.isBakeryIncome || transaction?.is_bakery_income || false);
  const [clientName, setClientName] = useState(transaction?.clientName || transaction?.client_name || '');

  // Expense specific
  const [expenseType, setExpenseType] = useState(transaction?.expenseType || transaction?.expense_type || initialExpenseType || 'fixed'); // fixed, variable, planned
  const [recurrence, setRecurrence] = useState(transaction?.recurrence || 'monthly');
  const [interestRate, setInterestRate] = useState(transaction?.interestRate ? transaction.interestRate.toString() : '');
  const [isActive, setIsActive] = useState(transaction?.active !== false); // Default true
  const [endDate, setEndDate] = useState(transaction?.end_date || ''); // New state for end date
  const [installments, setInstallments] = useState(transaction?.installments ? transaction.installments.toString() : ''); // New state for installments
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Planned Expenses
  const [plannedEntries, setPlannedEntries] = useState([{ dateStr: '', amount: '' }]);
  const [activeDateIndex, setActiveDateIndex] = useState(null);

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

  const onPlannedDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate && activeDateIndex !== null) {
      const d = String(selectedDate.getDate()).padStart(2, '0');
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const y = selectedDate.getFullYear();
      const newEntries = [...plannedEntries];
      newEntries[activeDateIndex].dateStr = `${y}-${m}-${d}`;
      setPlannedEntries(newEntries);
      setActiveDateIndex(null);
    }
  };

  const updatePlannedEntry = (index, field, value) => {
      const newEntries = [...plannedEntries];
      newEntries[index][field] = value;
      setPlannedEntries(newEntries);
  };

  const addPlannedEntry = () => {
      setPlannedEntries([...plannedEntries, { dateStr: '', amount: '' }]);
  };

  const removePlannedEntry = (index) => {
      if (plannedEntries.length > 1) {
          const newEntries = plannedEntries.filter((_, i) => i !== index);
          setPlannedEntries(newEntries);
      }
  };

  const formatDateDisplay = (isoDate) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleSubmit = async () => {
    if (type === 'expense' && expenseType === 'planned' && !isEditing) {
      if (!description || plannedEntries.length === 0) {
          Alert.alert('Erro', 'Preencha a descrição e as datas.');
          return;
      }
      const isValid = plannedEntries.every(e => e.dateStr && e.amount);
      if (!isValid) {
          Alert.alert('Erro', 'Preencha todas as datas e valores planejados.');
          return;
      }
    } else {
      if (!description || !amount || !date) {
        Alert.alert('Erro', 'Preencha os campos obrigatórios');
        return;
      }
    }

    setLoading(true);
    try {
      if (type === 'expense' && expenseType === 'planned' && !isEditing) {
          const transactionsToInsert = plannedEntries.map((entry, index) => {
              const [y, m, d] = entry.dateStr.split('-');
              return {
                  description,
                  amount: parseFloat(entry.amount.replace(',', '.')),
                  type: 'expense',
                  payment_method: paymentMethod,
                  date: entry.dateStr,
                  status: 'Aguardando',
                  expense_type: 'fixed',
                  recurrence: null,
                  active: true,
                  end_date: entry.dateStr,
                  user_id: user.id,
                  user_email: user.email,
                  installments: plannedEntries.length,
                  current_installment: index + 1
              };
          });

          await transactionService.createMany(transactionsToInsert);
          Alert.alert('Sucesso', 'Despesas planejadas criadas com sucesso!');
          navigation.goBack();
          return;
      }

      const [year, month, day] = date.split('-');
      const timestamp = new Date(year, month - 1, day).getTime();

      const transactionData = {
        description,
        amount: parseFloat(amount.replace(',', '.')),
        type,
        payment_method: paymentMethod,
        date: date, // Keep YYYY-MM-DD format for database
        user_id: user.id,
        user_email: user.email, // Salvar o email no mobile também
        is_bakery_income: type === 'income' ? isBakeryIncome : false,
        client_name: type === 'income' && isBakeryIncome ? clientName : null,
        expense_type: type === 'expense' ? expenseType : null,
        recurrence: type === 'expense' && expenseType === 'fixed' ? recurrence : null,
        interest_rate: type === 'expense' && expenseType === 'fixed' && interestRate ? parseFloat(interestRate.replace(',', '.')) : null,
        active: type === 'expense' && expenseType === 'fixed' ? isActive : null,
        end_date: type === 'expense' && expenseType === 'fixed' && !isActive ? endDate : null,
        installments: type === 'expense' && expenseType === 'fixed' && installments && parseInt(installments) > 1 && !isEditing ? parseInt(installments) : null
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
                   user_id: user.id,
                   user_email: user.email
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
          // Lógica de parcelamento
          if (transactionData.installments && transactionData.installments > 1) {
              const installmentCount = transactionData.installments;
              const installmentAmount = Number((transactionData.amount / installmentCount).toFixed(2));
              
              // Ajustar diferença de arredondamento na última parcela
              const totalCalculated = installmentAmount * (installmentCount - 1);
              const lastInstallmentAmount = Number((transactionData.amount - totalCalculated).toFixed(2));

              const transactionsToInsert = [];
              const [y, m, d] = transactionData.date.split('-');
              let currentDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

              for (let i = 1; i <= installmentCount; i++) {
                  const currentAmount = i === installmentCount ? lastInstallmentAmount : installmentAmount;
                  
                  const installDate = new Date(currentDate);
                  if (i > 1) {
                      installDate.setMonth(installDate.getMonth() + (i - 1));
                  }

                  const formattedInstallDate = `${installDate.getFullYear()}-${String(installDate.getMonth() + 1).padStart(2, '0')}-${String(installDate.getDate()).padStart(2, '0')}`;

                  transactionsToInsert.push({
                      ...transactionData,
                      amount: currentAmount,
                      date: formattedInstallDate,
                      current_installment: i,
                      active: i === installmentCount ? false : true,
                      end_date: formattedInstallDate,
                      recurrence: null
                  });
              }

              await transactionService.createMany(transactionsToInsert);
              Alert.alert('Sucesso', 'Transação parcelada criada com sucesso!');
              navigation.goBack();
              return;
          } else {
              await transactionService.create(transactionData);
          }

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

          {!(type === 'expense' && expenseType === 'planned' && !isEditing) && (
            <>
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

              {showDatePicker && activeDateIndex === null && (
                <DateTimePicker
                  value={new Date(date.split('-')[0], date.split('-')[1] - 1, date.split('-')[2])}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                />
              )}
            </>
          )}

          {/* Payment Method */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Método de Pagamento</Text>
            <View className="flex-row flex-wrap gap-2">
              {[
                  { id: 'pix', label: 'Pix' },
                  { id: 'dinheiro', label: 'Dinheiro' },
                  { id: 'cartao', label: 'Cartão de Crédito' },
                  { id: 'debito', label: 'Cartão de Débito' },
                  { id: 'credito_loja', label: 'Crédito Loja' },
                  { id: 'vale_alimentacao', label: 'V. Alimentação' },
                  { id: 'vale_combustivel', label: 'V. Combustível' },
                  { id: 'diversos', label: 'Diversos' }
              ].map((method) => (
                <TouchableOpacity
                  key={method.id}
                  onPress={() => setPaymentMethod(method.id)}
                  className={`px-3 py-1.5 rounded-lg border ${
                    paymentMethod === method.id 
                      ? 'bg-purple-50 border-[#7E1A8B]' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={paymentMethod === method.id ? 'text-[#7E1A8B] font-medium' : 'text-gray-600'}>
                    {method.label}
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
                {!isEditing && (
                  <TouchableOpacity
                    onPress={() => setExpenseType('planned')}
                    className={`flex-1 py-2 items-center rounded-lg border ${
                      expenseType === 'planned' ? 'bg-white border-[#7E1A8B]' : 'bg-transparent border-gray-200'
                    }`}
                  >
                    <Text>Planejada</Text>
                  </TouchableOpacity>
                )}
              </View>

              {expenseType === 'planned' && !isEditing && (
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-2">Datas e Valores</Text>
                  {plannedEntries.map((entry, idx) => (
                    <View key={idx} className="flex-row items-center gap-2 mb-2">
                      <TouchableOpacity 
                        onPress={() => {
                          setActiveDateIndex(idx);
                          setShowDatePicker(true);
                        }} 
                        className="flex-1"
                      >
                        <View pointerEvents="none">
                          <Input
                            placeholder="Data"
                            value={formatDateDisplay(entry.dateStr)}
                            editable={false}
                          />
                        </View>
                      </TouchableOpacity>
                      <View className="flex-1">
                        <Input
                          placeholder="Valor"
                          value={entry.amount}
                          onChangeText={(val) => updatePlannedEntry(idx, 'amount', val)}
                          keyboardType="numeric"
                        />
                      </View>
                      {plannedEntries.length > 1 && (
                        <TouchableOpacity onPress={() => removePlannedEntry(idx)} className="p-2 bg-red-50 rounded-lg mb-4">
                          <X size={20} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  
                  {showDatePicker && activeDateIndex !== null && (
                    <DateTimePicker
                      value={plannedEntries[activeDateIndex]?.dateStr ? new Date(plannedEntries[activeDateIndex].dateStr.split('-')[0], plannedEntries[activeDateIndex].dateStr.split('-')[1] - 1, plannedEntries[activeDateIndex].dateStr.split('-')[2]) : new Date()}
                      mode="date"
                      display="default"
                      onChange={onPlannedDateChange}
                    />
                  )}

                  <TouchableOpacity onPress={addPlannedEntry} className="mt-2 py-2 items-center rounded-lg bg-blue-50">
                    <Text className="text-blue-600 font-medium">+ Adicionar nova data</Text>
                  </TouchableOpacity>
                </View>
              )}

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

                  {!isEditing && (
                      <Input
                        label="Parcelas (Opcional)"
                        placeholder="Ex: 3"
                        value={installments}
                        onChangeText={setInstallments}
                        keyboardType="numeric"
                        helperText="Se preenchido, o valor acima será dividido por este número de parcelas."
                      />
                  )}

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