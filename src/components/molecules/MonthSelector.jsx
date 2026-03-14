import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function MonthSelector({ currentDate, onMonthChange, viewMode = 'month' }) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const handlePrev = () => {
        if (viewMode === 'year') {
            onMonthChange(new Date(year - 1, month, 1));
        } else {
            onMonthChange(new Date(year, month - 1, 1));
        }
    };

    const handleNext = () => {
        if (viewMode === 'year') {
            onMonthChange(new Date(year + 1, month, 1));
        } else {
            onMonthChange(new Date(year, month + 1, 1));
        }
    };

    return (
        <View className="flex-row items-center justify-between bg-white p-2 rounded-xl border border-gray-100 mb-4 shadow-sm">
            <TouchableOpacity 
                onPress={handlePrev}
                className="p-2 bg-gray-50 rounded-lg"
            >
                <ChevronLeft size={20} color="#6B7280" />
            </TouchableOpacity>
            
            <View className="items-center min-w-[100px]">
                {viewMode === 'month' && (
                    <Text className="text-sm font-bold text-gray-900">
                        {MONTHS[month]}
                    </Text>
                )}
                <Text className={`${viewMode === 'year' ? 'text-lg font-bold text-gray-900' : 'text-xs text-gray-500'}`}>
                    {year}
                </Text>
            </View>

            <TouchableOpacity 
                onPress={handleNext}
                className="p-2 bg-gray-50 rounded-lg"
            >
                <ChevronRight size={20} color="#6B7280" />
            </TouchableOpacity>
        </View>
    );
}
