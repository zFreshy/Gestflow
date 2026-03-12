import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LoginPage } from './src/pages/LoginPage';
import { View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const Stack = createNativeStackNavigator();

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
          // TODO: Replace with Dashboard/Drawer Navigator later
          <Stack.Screen name="Dashboard" component={PlaceholderDashboard} />
        ) : (
          <Stack.Screen name="Login" component={LoginPage} />
        )}
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

// Temporary placeholder
function PlaceholderDashboard() {
    const { signOut } = useAuth();
    return (
        <View className="flex-1 items-center justify-center bg-white">
            <Text className="text-xl font-bold mb-4">Bem-vindo ao Fornalha!</Text>
            <Text className="text-gray-500 mb-8" onPress={signOut}>Sair</Text>
        </View>
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