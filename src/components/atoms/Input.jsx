import React, { useState } from 'react';
import { TextInput, View, Text } from 'react-native';

export function Input({ label, error, rightElement, helperText, ...props }) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View className="mb-4 w-full">
            {label && (
                <Text className="text-sm font-medium text-gray-700 mb-1 ml-1">
                    {label}
                </Text>
            )}
            <View 
                className={`flex-row items-center w-full h-12 rounded-xl bg-white border ${
                    error 
                        ? 'border-red-500' 
                        : isFocused 
                            ? 'border-[#7E1A8B]' 
                            : 'border-gray-200'
                }`}
            >
                <TextInput
                    className="flex-1 h-full px-4 text-sm font-medium text-gray-900"
                    placeholderTextColor="#9CA3AF"
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    {...props}
                />
                {rightElement && (
                    <View className="mr-4">
                        {rightElement}
                    </View>
                )}
            </View>
            {error && (
                <Text className="text-xs text-red-500 mt-1 ml-1">
                    {error}
                </Text>
            )}
            {helperText && !error && (
                <Text className="text-xs text-gray-500 mt-1 ml-1">
                    {helperText}
                </Text>
            )}
        </View>
    );
}