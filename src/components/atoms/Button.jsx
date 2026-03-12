import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

export function Button({ title, onPress, loading, variant = 'primary', className = '', ...props }) {
    const baseStyles = "h-12 rounded-xl flex items-center justify-center shadow-sm active:opacity-90";
    const variants = {
        primary: "bg-[#7E1A8B]",
        secondary: "bg-white border border-gray-200",
        danger: "bg-red-500",
        ghost: "bg-transparent shadow-none"
    };

    const textStyles = {
        primary: "text-white font-semibold",
        secondary: "text-gray-700 font-medium",
        danger: "text-white font-semibold",
        ghost: "text-[#7E1A8B] font-medium"
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={loading}
            className={`${baseStyles} ${variants[variant]} ${className}`}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'secondary' ? '#7E1A8B' : '#fff'} />
            ) : (
                <Text className={`${textStyles[variant]}`}>{title}</Text>
            )}
        </TouchableOpacity>
    );
}