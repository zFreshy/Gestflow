import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, Platform } from 'react-native';
import { X, Calendar, DollarSign, Check } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from '../atoms/Button';

export function PaymentModal({ isVisible, transaction, onClose, onConfirm }) {
    const today = new Date().toISOString().split('T')[0];
    const [paymentDate, setPaymentDate] = useState(today);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [interestAmount, setInterestAmount] = useState('');
    
    // Reset state when modal opens/closes
    useEffect(() => {
        if (isVisible) {
            setPaymentDate(today);
            setInterestAmount('');
        }
    }, [isVisible]);

    const onDateChange = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate) {
            const d = String(selectedDate.getDate()).padStart(2, '0');
            const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const y = selectedDate.getFullYear();
            setPaymentDate(`${y}-${m}-${d}`);
        }
    };

    const formatDateDisplay = (isoDate) => {
        if (!isoDate) return '';
        const [year, month, day] = isoDate.split('-');
        return `${day}/${month}/${year}`;
    };

    const handleSubmit = () => {
        const interest = interestAmount ? parseFloat(interestAmount.replace(',', '.')) : 0;
        
        // Ensure date format compatibility
        let finalDate = paymentDate;
        if (paymentDate.includes('/')) {
            const [day, month, year] = paymentDate.split('/');
            finalDate = `${year}-${month}-${day}`;
        }
        
        onConfirm(transaction?.id, 'Pago', finalDate, interest);
        onClose();
    };

    const handleSetToday = () => {
        setPaymentDate(today);
    };

    if (!transaction) return null;

    return (
        <Modal
            visible={isVisible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-center items-center px-4">
                <View className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl">
                    {/* Header */}
                    <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
                        <View>
                            <Text className="text-lg font-bold text-gray-900">Confirmar Pagamento</Text>
                            <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
                                {transaction.description}
                            </Text>
                        </View>
                        <TouchableOpacity 
                            onPress={onClose}
                            className="h-8 w-8 rounded-full bg-gray-100 items-center justify-center"
                        >
                            <X size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {/* Body */}
                    <View className="p-4 space-y-6">
                        {/* Date Selection */}
                        <View>
                            <Text className="text-sm font-medium text-gray-700 mb-3">Quando foi pago?</Text>
                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    onPress={handleSetToday}
                                    className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border ${
                                        paymentDate === today
                                            ? 'bg-emerald-50 border-emerald-200'
                                            : 'bg-white border-gray-200'
                                    }`}
                                >
                                    <Calendar size={16} color={paymentDate === today ? "#059669" : "#6B7280"} />
                                    <Text className={`font-medium ${
                                        paymentDate === today ? 'text-emerald-700' : 'text-gray-600'
                                    }`}>
                                        Hoje
                                    </Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    onPress={() => setShowDatePicker(true)}
                                    className={`flex-1 justify-center px-3 border rounded-xl ${
                                        paymentDate !== today ? 'border-emerald-500 bg-emerald-50/10' : 'border-gray-200'
                                    }`}
                                >
                                    <Text className="text-gray-900 text-center font-medium h-12 pt-3">
                                        {formatDateDisplay(paymentDate)}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={new Date(paymentDate.split('-')[0], paymentDate.split('-')[1] - 1, paymentDate.split('-')[2])}
                                    mode="date"
                                    display="default"
                                    onChange={onDateChange}
                                />
                            )}
                        </View>

                        {/* Interest Input */}
                        <View>
                            <Text className="text-sm font-medium text-gray-700 mb-3">
                                Houve juros? <Text className="text-gray-400 font-normal text-xs">(Opcional)</Text>
                            </Text>
                            <View className="relative">
                                <View className="absolute left-3 top-3 z-10">
                                    <DollarSign size={16} color="#9CA3AF" />
                                </View>
                                <TextInput
                                    value={interestAmount}
                                    onChangeText={setInterestAmount}
                                    placeholder="0,00"
                                    keyboardType="numeric"
                                    className="pl-9 pr-4 h-12 border border-gray-200 rounded-xl text-gray-900 bg-gray-50"
                                />
                            </View>
                        </View>

                        {/* Actions */}
                        <View className="pt-2">
                            <TouchableOpacity
                                onPress={handleSubmit}
                                className="bg-[#7E1A8B] py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-lg shadow-purple-200"
                            >
                                <Check size={20} color="white" />
                                <Text className="text-white font-bold text-base">Confirmar Pagamento</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
