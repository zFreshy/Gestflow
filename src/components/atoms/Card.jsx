import React from 'react';
import { View } from 'react-native';
import { cn } from '../../utils';

export function Card({ children, className, ...props }) {
  return (
    <View 
      className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-4", className)} 
      {...props}
    >
      {children}
    </View>
  );
}