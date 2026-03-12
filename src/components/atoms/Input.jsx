import React from 'react';
import { TextInput, View, Text } from 'react-native';

export function Input({ label, error, ...props }) {
    return (
        <View className="mb-4 w-full">
            {label && (
                <Text className="text-sm font-medium text-gray-700 mb-1 ml-1">
                    {label}
                </Text>
            )}
            <TextInput
                className={`w-full h-12 px-4 rounded-xl bg-white border text-sm font-medium ${
                    error ? 'border-red-500' : 'border-gray-200 focus:border-[#7E1A8B]'
                }`}
                placeholderTextColor="#9CA3AF"
                {...props}
            />
            {error && (
                <Text className="text-xs text-red-500 mt-1 ml-1">
                    {error}
                </Text>
            )}
        </View>
    );
}