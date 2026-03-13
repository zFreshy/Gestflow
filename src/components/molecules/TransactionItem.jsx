import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '../atoms/Card';
import { cn, formatCurrency, formatDate } from '../../utils';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react-native';

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

export function TransactionItem({ transaction }) {
  const isIncome = transaction.type === 'income';
  
  // Status Logic
  let statusLabel = STATUS_MAP[transaction.type]?.label || 'Processado';
  let statusColor = STATUS_MAP[transaction.type]?.color || 'text-gray-500';
  let statusBg = STATUS_MAP[transaction.type]?.bgColor || 'bg-gray-50';

  if (transaction.type === 'expense' && transaction.expenseType === 'fixed') {
      if (transaction.isVirtual) {
          statusLabel = 'Previsto';
          statusColor = 'text-amber-600';
          statusBg = 'bg-amber-50';
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
    <Card className={cn(
        "mb-3 flex-row items-center p-3 border",
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
                {isPaid ? `Pago em: ${formatDate(transaction.date)}` : `Vence em: ${formatDate(transaction.date)}`}
            </Text>
            <Text className="text-xs text-emerald-600 font-medium mr-2">
                {METHOD_LABELS[transaction.paymentMethod] || transaction.paymentMethod}
            </Text>
            
            {transaction.expenseType === 'fixed' && (
                <View className="bg-gray-100 px-1.5 py-0.5 rounded mr-1">
                    <Text className="text-[10px] text-gray-500">
                        Fixa {transaction.recurrence ? `• ${RECURRENCE_MAP[transaction.recurrence.toLowerCase()] || transaction.recurrence}` : ''}
                    </Text>
                </View>
            )}
        </View>
      </View>
      
      <View className="items-end">
          <Text className={cn("font-bold text-base", isIncome ? "text-emerald-600" : "text-red-600")}>
            {isIncome ? "+" : "-"} {formatCurrency(transaction.amount)}
          </Text>
          
          <View className={cn("px-2 py-0.5 rounded-full mt-1", statusBg)}>
              <Text className={cn("text-[10px] font-bold", statusColor)}>
                  {statusLabel}
              </Text>
          </View>
      </View>
    </Card>
  );
}