import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EF4444', // red
];

export function DonutChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <View className="items-center justify-center h-40">
        <Text className="text-gray-400">Sem dados</Text>
      </View>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  let startAngle = 0;
  const radius = 60;
  const innerRadius = 40;
  const centerX = 70;
  const centerY = 70;

  const createArc = (start, end, r, innerR) => {
    // Prevent drawing error if start and end are same
    if (start === end) return '';
    
    // Handle full circle case
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
    <View className="flex-row items-center justify-between h-40">
      <View className="flex-1 mr-4">
        <View className="flex-col gap-2">
          {data.map((entry, idx) => (
            <View key={entry.name} className="flex-row items-center mb-1">
              <View 
                className="h-3 w-3 rounded-full mr-2"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <Text className="text-gray-900 font-medium text-xs flex-1">{entry.name}</Text>
              <Text className="text-gray-600 text-xs">{entry.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="items-center justify-center relative w-[140px] h-[140px]">
        <Svg height="140" width="140" viewBox="0 0 140 140">
          <G>
            {data.map((entry, idx) => {
              const angle = (entry.value / total) * 360;
              const path = createArc(startAngle, startAngle + angle, radius, innerRadius);
              const fill = COLORS[idx % COLORS.length];
              const currentStartAngle = startAngle;
              startAngle += angle;
              return <Path key={idx} d={path} fill={fill} />;
            })}
          </G>
        </Svg>
        <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center">
             <Text className="text-xl font-bold text-gray-900">{total}</Text>
        </View>
      </View>
    </View>
  );
}