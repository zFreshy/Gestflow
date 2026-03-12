import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '../atoms/Card';
import { cn, formatCurrency, formatDate } from '../../utils';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react-native';

export function TransactionItem({ transaction }) {
  const isIncome = transaction.type === 'income';
  
  return (
    <Card className="mb-3 flex-row items-center p-3">
      <View className={cn("p-2 rounded-full mr-3", isIncome ? "bg-emerald-50" : "bg-red-50")}>
        {isIncome ? (
          <ArrowUpCircle size={24} color="#059669" />
        ) : (
          <ArrowDownCircle size={24} color="#DC2626" />
        )}
      </View>
      
      <View className="flex-1">
        <Text className="font-semibold text-gray-900 text-base">{transaction.description}</Text>
        <Text className="text-xs text-gray-500">
            {formatDate(transaction.date)} • {transaction.paymentMethod === 'pix' ? 'Pix' : transaction.paymentMethod === 'cartao' ? 'Cartão' : 'Dinheiro'}
        </Text>
      </View>
      
      <Text className={cn("font-bold text-base", isIncome ? "text-emerald-600" : "text-red-600")}>
        {isIncome ? "+" : "-"} {formatCurrency(transaction.amount)}
      </Text>
    </Card>
  );
}