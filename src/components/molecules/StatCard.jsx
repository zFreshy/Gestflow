import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '../atoms/Card';
import { cn, formatCurrency } from '../../utils';

export function StatCard({ title, value, icon: Icon, accent = "blue", subtext, trend, children, isCurrency = true, className }) {
  const accentColors = {
    blue: "bg-blue-500/10 text-blue-400",
    green: "bg-emerald-500/10 text-emerald-400",
    red: "bg-red-500/10 text-red-400",
    yellow: "bg-amber-500/10 text-amber-400",
    purple: "bg-purple-500/10 text-purple-400",
  };

  const iconColor = {
    blue: "#60A5FA", // blue-400
    green: "#34D399", // emerald-400
    red: "#F87171", // red-400
    yellow: "#FBBF24", // amber-400
    purple: "#C084FC", // purple-400
  };

  return (
    <Card className={cn("flex-1 min-w-[120px] mr-0 mb-4 bg-[#18181b] border-zinc-800", className)}>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs font-medium text-zinc-400">{title}</Text>
        {Icon && (
          <View className={cn("p-2 rounded-lg", accentColors[accent])}>
            <Icon size={16} color={iconColor[accent]} />
          </View>
        )}
      </View>
      <View>
        {value !== null && value !== undefined && (
            <Text className="text-2xl font-bold text-white">
            {isCurrency && typeof value === 'number' ? formatCurrency(value) : value}
            </Text>
        )}
        {subtext && (
          <Text className="text-xs text-zinc-500 mt-1">{subtext}</Text>
        )}
        {trend && (
          <View className="flex-row items-center mt-2">
            <Text className={cn("text-xs font-medium", trend > 0 ? "text-emerald-400" : "text-red-400")}>
              {trend > 0 ? "+" : ""}{trend}%
            </Text>
          </View>
        )}
        {children}
      </View>
    </Card>
  );
}