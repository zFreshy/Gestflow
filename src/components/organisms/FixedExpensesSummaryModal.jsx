import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Dimensions } from 'react-native';
import { X, FileText, CheckCircle, Clock, ChevronRight, ArrowLeft } from 'lucide-react-native';
import { formatCurrency } from '../../utils';

export function FixedExpensesSummaryModal({ isOpen, onClose, transactions }) {
    const [selectedGroup, setSelectedGroup] = useState(null);

    const isPaid = (status) => ['Pago', 'Liberado', 'pago', 'liberado'].includes(status);

    const parseDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return new Date(year, month - 1, day);
        }
        if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            return new Date(year, month - 1, day);
        }
        return new Date(0);
    };

    const summaryData = useMemo(() => {
        const groups = {};

        transactions
            .filter(t => t.type === 'expense' && t.expenseType === 'fixed')
            .forEach(t => {
                if (!groups[t.description]) {
                    groups[t.description] = {
                        description: t.description,
                        paidCount: 0,
                        paidAmount: 0,
                        pendingCount: 0,
                        pendingAmount: 0,
                        isPlannedOrParceled: !!t.installments,
                        totalInstallments: t.installments || null,
                        recurrence: t.recurrence,
                        hasEndDate: !!t.end_date,
                        endDate: t.end_date,
                        items: []
                    };
                }

                groups[t.description].items.push(t);

                if (isPaid(t.status)) {
                    groups[t.description].paidCount += 1;
                    groups[t.description].paidAmount += t.amount;
                } else {
                    groups[t.description].pendingCount += 1;
                    groups[t.description].pendingAmount += t.amount;
                }
            });

        return Object.values(groups).sort((a, b) => b.paidAmount - a.paidAmount);
    }, [transactions]);

    const handleClose = () => {
        setSelectedGroup(null);
        onClose();
    };

    const renderList = () => (
        <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }}>
            <View className="gap-3">
                {summaryData.map((item, idx) => (
                    <TouchableOpacity 
                        key={idx} 
                        onPress={() => setSelectedGroup(item)}
                        className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex-row items-center justify-between gap-4"
                    >
                        <View className="flex-row items-center flex-1 gap-4">
                            <View className="h-10 w-10 rounded-full bg-purple-50 items-center justify-center">
                                <FileText size={20} color="#7E1A8B" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-semibold text-gray-900" numberOfLines={1}>{item.description}</Text>
                                <View className="flex-row items-center mt-1 flex-wrap gap-1">
                                    {item.isPlannedOrParceled ? (
                                        <View className="bg-blue-100 px-2 py-0.5 rounded-full">
                                            <Text className="text-[10px] text-blue-700 font-medium">Planejada/Parcelada</Text>
                                        </View>
                                    ) : (
                                        <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                                            <Text className="text-[10px] text-gray-700 font-medium">Recorrente</Text>
                                        </View>
                                    )}
                                    <Text className="text-gray-500 text-[10px] ml-1">• Total: {formatCurrency(item.paidAmount + item.pendingAmount)}</Text>
                                </View>
                            </View>
                        </View>
                        <ChevronRight size={20} color="#D1D5DB" />
                    </TouchableOpacity>
                ))}
                {summaryData.length === 0 && (
                    <View className="items-center justify-center py-10">
                        <Text className="text-gray-500">Nenhuma despesa fixa encontrada.</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );

    const renderDetail = () => {
        if (!selectedGroup) return null;

        const sortedItems = [...selectedGroup.items].sort((a, b) => parseDate(a.date) - parseDate(b.date));
        const nextPending = sortedItems.find(t => !isPaid(t.status));
        let daysToNext = null;
        
        if (nextPending) {
            const nextDate = parseDate(nextPending.date);
            const today = new Date();
            today.setHours(0,0,0,0);
            const diffTime = nextDate - today;
            daysToNext = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        return (
            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Header Detail */}
                <View className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm mb-6">
                    <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-lg font-bold text-gray-900 flex-1" numberOfLines={2}>{selectedGroup.description}</Text>
                        {selectedGroup.isPlannedOrParceled && (
                            <View className="bg-blue-100 px-2 py-1 rounded-full ml-2">
                                <Text className="text-[10px] text-blue-700 font-medium">
                                    Planejada/Parcelada ({selectedGroup.paidCount}/{selectedGroup.totalInstallments})
                                </Text>
                            </View>
                        )}
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1 bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                            <View className="flex-row items-center gap-1 mb-1">
                                <CheckCircle size={14} color="#10B981" />
                                <Text className="text-xs text-emerald-600 font-medium">Total Pago</Text>
                            </View>
                            <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>{formatCurrency(selectedGroup.paidAmount)}</Text>
                            <Text className="text-[10px] text-gray-500 mt-1">{selectedGroup.paidCount} ocorrências</Text>
                        </View>
                        
                        <View className="flex-1 bg-amber-50 p-4 rounded-lg border border-amber-100">
                            <View className="flex-row items-center gap-1 mb-1">
                                <Clock size={14} color="#F59E0B" />
                                <Text className="text-xs text-amber-600 font-medium">Restante</Text>
                            </View>
                            {selectedGroup.isPlannedOrParceled ? (
                                <>
                                    <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>{formatCurrency(selectedGroup.pendingAmount)}</Text>
                                    <Text className="text-[10px] text-gray-500 mt-1">{selectedGroup.pendingCount} pendentes</Text>
                                </>
                            ) : (
                                <View className="flex-1 justify-center">
                                    <Text className="text-xs font-medium text-gray-500 italic">Despesa Contínua</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {nextPending && (
                        <View className="mt-4 p-3 bg-blue-50 rounded-lg flex-row items-center justify-between">
                            <View className="flex-row items-center gap-2">
                                <Clock size={16} color="#1E40AF" />
                                <View>
                                    <Text className="text-xs font-medium text-blue-800">Próximo Vencimento:</Text>
                                    <Text className="text-xs text-blue-800">{nextPending.date}</Text>
                                </View>
                            </View>
                            <Text className="font-bold text-blue-800 text-xs">
                                {daysToNext === 0 ? 'Vence hoje!' : daysToNext < 0 ? `Atrasado ${Math.abs(daysToNext)} dias` : `Faltam ${daysToNext} dias`}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Timeline */}
                <Text className="text-sm font-bold text-gray-900 mb-3 px-1">Histórico e Previsão</Text>
                <View className="pl-4">
                    {sortedItems.map((item, idx) => {
                        const paid = isPaid(item.status);
                        const isLast = idx === sortedItems.length - 1;
                        return (
                            <View key={idx} className="flex-row relative">
                                {!isLast && (
                                    <View className="absolute left-[11px] top-6 bottom-[-10px] w-0.5 bg-gray-200" />
                                )}
                                <View className="mr-4 mt-1 z-10">
                                    {paid ? (
                                        <View className="h-6 w-6 rounded-full bg-emerald-100 items-center justify-center border-2 border-white">
                                            <CheckCircle size={14} color="#10B981" />
                                        </View>
                                    ) : (
                                        <View className="h-6 w-6 rounded-full bg-gray-100 items-center justify-center border-2 border-white">
                                            <View className="h-2 w-2 rounded-full bg-gray-300" />
                                        </View>
                                    )}
                                </View>
                                
                                <View className="flex-1 bg-white p-3 rounded-xl border border-gray-100 shadow-sm mb-4">
                                    <View className="flex-row items-center justify-between mb-1">
                                        <Text className={`text-xs font-bold ${paid ? "text-emerald-600" : "text-gray-500"}`}>
                                            {item.date}
                                        </Text>
                                        <View className={`px-2 py-0.5 rounded-full ${paid ? "bg-emerald-100" : "bg-amber-100"}`}>
                                            <Text className={`text-[10px] font-medium ${paid ? "text-emerald-700" : "text-amber-700"}`}>
                                                {paid ? 'Pago' : 'Pendente'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center justify-between mt-1">
                                        <Text className="text-xs text-gray-600">
                                            {item.current_installment ? `Parcela ${item.current_installment}` : 'Ocorrência'}
                                        </Text>
                                        <Text className={`font-bold ${paid ? "text-gray-900" : "text-gray-500"}`}>
                                            {formatCurrency(item.amount)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        );
    };

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            transparent={false}
            onRequestClose={handleClose}
        >
            <View className="flex-1 bg-gray-50">
                <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-100">
                    <View className="flex-row items-center gap-3">
                        {selectedGroup ? (
                            <TouchableOpacity 
                                onPress={() => setSelectedGroup(null)}
                                className="h-10 w-10 rounded-full bg-gray-100 items-center justify-center"
                            >
                                <ArrowLeft size={20} color="#4B5563" />
                            </TouchableOpacity>
                        ) : (
                            <View className="h-10 w-10 rounded-full bg-purple-100 items-center justify-center">
                                <FileText size={20} color="#7E1A8B" />
                            </View>
                        )}
                        <View>
                            <Text className="text-lg font-bold text-gray-900">
                                {selectedGroup ? 'Detalhes' : 'Resumo de Despesas'}
                            </Text>
                            <Text className="text-xs text-gray-500">
                                {selectedGroup ? 'Acompanhamento' : 'Selecione uma despesa'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        onPress={handleClose}
                        className="h-10 w-10 rounded-full items-center justify-center bg-gray-50"
                    >
                        <X size={20} color="#4B5563" />
                    </TouchableOpacity>
                </View>

                {selectedGroup ? renderDetail() : renderList()}
            </View>
        </Modal>
    );
}