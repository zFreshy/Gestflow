import React, { useState } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text, Modal, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LayoutDashboard, Receipt, FileText, Calendar, MoreHorizontal, Plus, LogOut, X, ChevronRight } from 'lucide-react-native';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LoginPage } from './src/pages/LoginPage';
import { DashboardPage } from './src/pages/DashboardPage';
import { TransactionsPage } from './src/pages/TransactionsPage';
import { TransactionForm } from './src/pages/TransactionForm';
import { FixedExpensesPage } from './src/pages/FixedExpensesPage';

// Placeholder Pages
const PlaceholderPage = ({ route }) => (
  <View className="flex-1 items-center justify-center bg-white p-6">
    <Text className="text-2xl font-bold text-gray-900 mb-2">{route.name}</Text>
    <Text className="text-gray-500 text-center">Funcionalidade em desenvolvimento.</Text>
  </View>
);

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MoreMenu({ isVisible, onClose, navigation, signOut }) {
  const MENU_ITEMS = [
    { name: 'Calendar', label: 'Calendário', icon: Calendar },
  ];

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <TouchableOpacity className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl p-6 min-h-[40%]">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold text-gray-900">Mais Opções</Text>
            <TouchableOpacity onPress={onClose} className="p-2 bg-gray-100 rounded-full">
              <X size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {MENU_ITEMS.map((item, index) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    onClose();
                    navigation.navigate(item.name);
                  }}
                  className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl mb-3 active:bg-purple-50"
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

            <View className="h-px bg-gray-100 my-4" />

            <TouchableOpacity
              onPress={() => {
                onClose();
                signOut();
              }}
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

function TabNavigator({ navigation }) {
  const { signOut } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#7E1A8B',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: '#F3F4F6',
            paddingBottom: insets.bottom > 0 ? insets.bottom + 5 : 5,
            paddingTop: 5,
            height: insets.bottom > 0 ? 60 + insets.bottom : 60,
            backgroundColor: '#FFFFFF',
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '500',
            marginTop: -4,
          }
        }}
      >
        <Tab.Screen 
          name="Dashboard" 
          component={DashboardPage} 
          options={{
            tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={24} />,
            tabBarLabel: 'Início'
          }}
        />
        <Tab.Screen 
          name="Transactions" 
          component={TransactionsPage} 
          options={{
            tabBarIcon: ({ color }) => <Receipt color={color} size={24} />,
            tabBarLabel: 'Transações'
          }}
        />
        
        {/* Center Add Button */}
        <Tab.Screen 
          name="AddTransactionPlaceholder" 
          component={View} 
          listeners={() => ({
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate('AddTransaction');
            },
          })}
          options={{
            tabBarIcon: () => (
              <View className="bg-[#7E1A8B] h-14 w-14 rounded-full items-center justify-center -mt-8 shadow-lg shadow-purple-200 border-4 border-white">
                <Plus color="white" size={28} />
              </View>
            ),
            tabBarLabel: ''
          }}
        />

        <Tab.Screen 
          name="FixedExpenses" 
          component={FixedExpensesPage} 
          options={{
            tabBarIcon: ({ color }) => <FileText color={color} size={24} />,
            tabBarLabel: 'Despesas'
          }}
        />

        <Tab.Screen 
          name="More" 
          component={View} 
          listeners={() => ({
            tabPress: (e) => {
              e.preventDefault();
              setIsMenuVisible(true);
            },
          })}
          options={{
            tabBarIcon: ({ color }) => <MoreHorizontal color={color} size={24} />,
            tabBarLabel: 'Mais'
          }}
        />
      </Tab.Navigator>

      <MoreMenu 
        isVisible={isMenuVisible} 
        onClose={() => setIsMenuVisible(false)} 
        navigation={navigation}
        signOut={signOut}
      />
    </>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#7E1A8B" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            <Stack.Screen 
              name="AddTransaction" 
              component={TransactionForm} 
              options={{ 
                presentation: 'modal',
                animation: 'slide_from_bottom'
              }}
            />
            {/* Screens accessible via Menu */}
            <Stack.Screen name="Calendar" component={PlaceholderPage} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginPage} />
        )}
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}