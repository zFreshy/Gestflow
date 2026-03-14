import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { Card } from '../atoms/Card';
import { cn, formatCurrency, formatDate } from '../../utils';
import { ArrowUpCircle, ArrowDownCircle, MoreVertical, Edit2, Trash2 } from 'lucide-react-native';

const STATUS_MAP = {
    income: { label: 'Aprovado', color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
    expense: { label: 'Processado', color: 'text-amber-500', bgColor: 'bg-amber-50' },
};

const RECURRENCE_MAP = {
    'daily': 'Diária',
    'weekly': 'Semanal',
    'monthly': 'Mensal',
    'quarterly': 'Trimestral',
    'semiannual': 'Semestral',
    'annual': 'Anual',
    'biennial': 'Bienal'
};

const METHOD_LABELS = {
    pix: 'Pix',
    cartao: 'Cartão',
    dinheiro: 'Dinheiro',
};

export function TransactionItem({ transaction, onEdit, onDelete }) {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const isIncome = transaction.type === 'income';
  
  const getTransactionDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-');
        return new Date(year, month - 1, day);
    }
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  };

  // Status Logic
  let statusLabel = STATUS_MAP[transaction.type]?.label || 'Processado';
  let statusColor = STATUS_MAP[transaction.type]?.color || 'text-gray-500';
  let statusBg = STATUS_MAP[transaction.type]?.bgColor || 'bg-gray-50';

  if (transaction.type === 'expense' && transaction.expenseType === 'fixed') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tDate = getTransactionDate(transaction.date);

      if (transaction.isVirtual) {
          if (tDate < today) {
              statusLabel = 'Atrasado';
              statusColor = 'text-red-600';
              statusBg = 'bg-red-50';
          } else {
              statusLabel = 'Previsto';
              statusColor = 'text-amber-600';
              statusBg = 'bg-amber-50';
          }
      } else if (['Pago', 'Liberado', 'pago', 'liberado'].includes(transaction.status)) {
          statusLabel = 'Pago';
          statusColor = 'text-emerald-600';
          statusBg = 'bg-emerald-50';
      } else if (transaction.isOverdue) {
          statusLabel = 'Atrasado';
          statusColor = 'text-red-600';
          statusBg = 'bg-red-50';
      } else {
          statusLabel = 'Pendente';
          statusColor = 'text-amber-600';
          statusBg = 'bg-amber-50';
      }
  }

  const isPaid = ['Pago', 'Liberado', 'pago', 'liberado'].includes(transaction.status);
  const isVirtual = transaction.isVirtual;
  const isOverdue = transaction.isOverdue;

  return (
    <View className="mb-3">
        <Card className={cn(
            "flex-row items-center p-3 border relative",
            isVirtual ? "border-dashed border-amber-300 bg-amber-50/30" : "border-gray-100",
            isOverdue && !isPaid && !isVirtual ? "border-red-200 bg-red-50/30" : "",
            isPaid ? "opacity-70" : ""
        )}>
        <View className={cn("p-2 rounded-full mr-3", isIncome ? "bg-emerald-50" : "bg-red-50")}>
            {isIncome ? (
            <ArrowUpCircle size={24} color="#059669" />
            ) : (
            <ArrowDownCircle size={24} color={isOverdue && !isPaid ? "#DC2626" : "#DC2626"} />
            )}
        </View>
        
        <View className="flex-1">
            <Text className={cn(
                "font-semibold text-base",
                isPaid ? "text-gray-500 line-through" : "text-gray-900",
                isOverdue && !isPaid ? "text-red-700" : ""
            )}>
                {transaction.description} {isVirtual && <Text className="text-amber-600 text-xs font-normal">(Previsão)</Text>}
            </Text>
            
            <View className="flex-row items-center mt-1 flex-wrap">
                <Text className={cn("text-xs mr-2", isOverdue && !isPaid ? "text-red-500 font-medium" : "text-gray-500")}>
                    {isPaid ? `Pago em: ${formatDate(transaction.date)}` 
                        : (transaction.expenseType === 'fixed' 
                            ? `Vence em: ${formatDate(transaction.date)}`
                            : formatDate(transaction.date)
                        )
                    }
                </Text>
                <Text className="text-xs text-emerald-600 font-medium mr-2">
                    {METHOD_LABELS[transaction.paymentMethod] || transaction.paymentMethod}
                </Text>
                
                {transaction.expenseType === 'fixed' && (
                    <View className="flex-row flex-wrap gap-1">
                        <View className="bg-gray-100 px-1.5 py-0.5 rounded mr-1">
                            <Text className="text-[10px] text-gray-500">
                                Fixa {transaction.recurrence ? `• ${RECURRENCE_MAP[transaction.recurrence.toLowerCase()] || transaction.recurrence}` : ''}
                            </Text>
                        </View>
                        {transaction.active === false && transaction.end_date && (
                            <View className="flex-row gap-1">
                                <View className="bg-orange-50 px-1.5 py-0.5 rounded mr-1 border border-orange-100">
                                    <Text className="text-[10px] text-orange-600 font-medium">
                                        Fim: {formatDate(transaction.end_date)}
                                    </Text>
                                </View>
                                <View className="bg-green-50 px-1.5 py-0.5 rounded mr-1 border border-green-100">
                                    <Text className="text-[10px] text-green-600 font-medium">
                                        Sem cobrança
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </View>
        
        <View className="items-end">
            <Text className={cn("font-bold text-base", isIncome ? "text-emerald-600" : "text-red-600")}>
                {isIncome ? "+" : "-"} {formatCurrency(transaction.amount)}
            </Text>
            
            <View className="flex-row items-center gap-2">
                <View className={cn("px-2 py-0.5 rounded-full mt-1", statusBg)}>
                    <Text className={cn("text-[10px] font-bold", statusColor)}>
                        {statusLabel}
                    </Text>
                </View>

                {!isVirtual && (onEdit || onDelete) && (
                    <TouchableOpacity 
                        onPress={() => setIsMenuVisible(true)}
                        className="p-1 rounded-full active:bg-gray-100"
                    >
                        <MoreVertical size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
                {isVirtual && onEdit && (
                    <TouchableOpacity 
                        onPress={() => setIsMenuVisible(true)}
                        className="p-1 rounded-full active:bg-gray-100"
                    >
                        <MoreVertical size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
        </Card>

        {/* Options Modal */}
        <Modal
            visible={isMenuVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setIsMenuVisible(false)}
        >
            <TouchableWithoutFeedback onPress={() => setIsMenuVisible(false)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <TouchableWithoutFeedback>
                        <View className="bg-white rounded-2xl w-full max-w-[280px] overflow-hidden">
                            <View className="p-4 border-b border-gray-100">
                                <Text className="text-lg font-bold text-gray-900 text-center">Opções</Text>
                                <Text className="text-sm text-gray-500 text-center mt-1" numberOfLines={1}>
                                    {transaction.description}
                                </Text>
                            </View>
                            
                            {onEdit && (
                                <TouchableOpacity 
                                    onPress={() => {
                                        setIsMenuVisible(false);
                                        onEdit(transaction);
                                    }}
                                    className="flex-row items-center p-4 border-b border-gray-100 active:bg-gray-50"
                                >
                                    <View className="h-8 w-8 bg-blue-50 rounded-full items-center justify-center mr-3">
                                        <Edit2 size={16} color="#2563EB" />
                                    </View>
                                    <Text className="text-gray-700 font-medium">Editar</Text>
                                </TouchableOpacity>
                            )}

                            {onDelete && !isVirtual && (
                                <TouchableOpacity 
                                    onPress={() => {
                                        setIsMenuVisible(false);
                                        onDelete(transaction);
                                    }}
                                    className="flex-row items-center p-4 active:bg-red-50"
                                >
                                    <View className="h-8 w-8 bg-red-50 rounded-full items-center justify-center mr-3">
                                        <Trash2 size={16} color="#DC2626" />
                                    </View>
                                    <Text className="text-red-600 font-medium">Excluir</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    </View>
  );
}