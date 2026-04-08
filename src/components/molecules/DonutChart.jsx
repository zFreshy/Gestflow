import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EF4444', // red
];

const getFillColor = (name, index) => {
    if (name === 'Entradas' || name === 'Receitas') return '#10B981'; // emerald
    if (name === 'Saídas' || name === 'Despesas') return '#EF4444'; // red
    if (name === 'Fornecedores') return '#3B82F6'; // blue
    if (name === 'Padaria') return '#F59E0B'; // amber
    if (name === 'Consultório') return '#3B82F6'; // blue
    if (name === 'Fixas') return '#8B5CF6'; // purple
    if (name === 'Variáveis') return '#EF4444'; // red
    return COLORS[index % COLORS.length];
};

export function DonutChart({ data, showBalance = false }) {
  if (!data || data.length === 0) {
    return (
      <View className="items-center justify-center h-28">
        <View className="flex-1 w-full justify-center">
            <View className="flex-row items-center mb-1 opacity-50">
              <View className="h-3 w-3 rounded-full mr-2 bg-gray-300" />
              <Text className="text-gray-900 font-medium text-[10px] flex-1">Entradas</Text>
              <Text className="text-gray-600 text-[10px]">R$ 0,00</Text>
            </View>
            <View className="flex-row items-center mb-1 opacity-50">
              <View className="h-3 w-3 rounded-full mr-2 bg-gray-300" />
              <Text className="text-gray-900 font-medium text-[10px] flex-1">Saídas</Text>
              <Text className="text-gray-600 text-[10px]">R$ 0,00</Text>
            </View>
        </View>
        <View className="absolute right-0 items-center justify-center relative w-[90px] h-[90px]">
             <Svg height="90" width="90" viewBox="0 0 90 90">
                <Circle cx="45" cy="45" r="30" stroke="#f3f4f6" strokeWidth="15" fill="none" />
             </Svg>
        </View>
      </View>
    );
  }

  const formatValue = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const balance = showBalance ? (data.find(d => d.name === 'Entradas')?.value || 0) - (data.find(d => d.name === 'Saídas')?.value || 0) - (data.find(d => d.name === 'Fornecedores')?.value || 0) : 0;
  
  let startAngle = 0;
  const radius = 45;
  const innerRadius = 30;
  const centerX = 45;
  const centerY = 45;

  const createArc = (start, end, r, innerR) => {
    if (start === end) return '';
    if (end - start === 360) {
        return `
            M ${centerX} ${centerY - r}
            A ${r} ${r} 0 1 1 ${centerX} ${centerY + r}
            A ${r} ${r} 0 1 1 ${centerX} ${centerY - r}
            M ${centerX} ${centerY - innerR}
            A ${innerR} ${innerR} 0 1 0 ${centerX} ${centerY + innerR}
            A ${innerR} ${innerR} 0 1 0 ${centerX} ${centerY - innerR}
            Z
        `;
    }

    const startRad = (start - 90) * Math.PI / 180;
    const endRad = (end - 90) * Math.PI / 180;
    
    const x1 = centerX + r * Math.cos(startRad);
    const y1 = centerY + r * Math.sin(startRad);
    const x2 = centerX + r * Math.cos(endRad);
    const y2 = centerY + r * Math.sin(endRad);
    
    const x3 = centerX + innerR * Math.cos(endRad);
    const y3 = centerY + innerR * Math.sin(endRad);
    const x4 = centerX + innerR * Math.cos(startRad);
    const y4 = centerY + innerR * Math.sin(startRad);

    const largeArcFlag = end - start <= 180 ? 0 : 1;

    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
  };

  return (
    <View className="flex-row items-center justify-between h-28 w-full">
      <View className="flex-1 mr-2">
        <View className="flex-col gap-2">
          {data.map((entry, idx) => (
            <View key={entry.name} className="flex-row items-center mb-1">
              <View 
                className="h-3 w-3 rounded-full mr-2"
                style={{ backgroundColor: getFillColor(entry.name, idx) }}
              />
              <Text className="text-gray-900 font-medium text-[10px] flex-1" numberOfLines={1}>{entry.name}</Text>
              <Text className="text-gray-600 text-[10px]">{formatValue(entry.value)}</Text>
            </View>
          ))}
          {showBalance && (
            <View className="flex-row items-center mt-1 pt-1 border-t border-gray-100">
              <View className="h-3 w-3 mr-2" />
              <Text className="text-gray-800 font-bold text-[10px] flex-1">Saldo</Text>
              <Text className={`font-bold text-[10px] ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatValue(balance)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="items-center justify-center relative w-[90px] h-[90px]">
        <Svg height="90" width="90" viewBox="0 0 90 90">
          <G>
            {total === 0 ? (
                <Circle cx="45" cy="45" r="30" stroke="#f3f4f6" strokeWidth="15" fill="none" />
            ) : data.map((entry, idx) => {
              const angle = (entry.value / total) * 360;
              const path = createArc(startAngle, startAngle + angle, radius, innerRadius);
              const fill = getFillColor(entry.name, idx);
              startAngle += angle;
              return <Path key={idx} d={path} fill={fill} />;
            })}
          </G>
        </Svg>
      </View>
    </View>
  );
}