import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LayoutDashboard, Receipt, FileText, Calendar, LogOut, X, ChevronRight } from 'lucide-react-native';

const MENU_ITEMS = [
    { name: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { name: 'Transactions', label: 'Transações', icon: Receipt },
    // Removed redundant 'FixedExpenses' since it's on the bottom bar
    { name: 'Calendar', label: 'Calendário', icon: Calendar },
];

export function MoreMenu({ navigation, isVisible, onClose }) {
    const { signOut } = useAuth();

    const handleNavigation = (screenName) => {
        onClose();
        navigation.navigate(screenName);
    };

    const handleLogout = async () => {
        onClose();
        await signOut();
    };

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-white rounded-t-3xl p-6 min-h-[50%]">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-xl font-bold text-gray-900">Menu</Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-gray-100 rounded-full">
                            <X size={20} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View className="space-y-2">
                            {MENU_ITEMS.map((item, index) => {
                                const Icon = item.icon;
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => handleNavigation(item.name)}
                                        className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl mb-2 active:bg-purple-50"
                                    >
                                        <View className="flex-row items-center gap-4">
                                            <View className="h-10 w-10 bg-white rounded-full items-center justify-center shadow-sm">
                                                <Icon size={20} color="#7E1A8B" />
                                            </View>
                                            <Text className="text-gray-900 font-medium text-base">{item.label}</Text>
                                        </View>
                                        <ChevronRight size={20} color="#9CA3AF" />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View className="h-px bg-gray-100 my-6" />

                        <TouchableOpacity
                            onPress={handleLogout}
                            className="flex-row items-center justify-between p-4 bg-red-50 rounded-xl"
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="h-10 w-10 bg-white rounded-full items-center justify-center shadow-sm">
                                    <LogOut size={20} color="#DC2626" />
                                </View>
                                <Text className="text-red-600 font-medium text-base">Sair da conta</Text>
                            </View>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}