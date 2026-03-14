import React, { useState } from 'react';
import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/atoms/Input';
import { Button } from '../components/atoms/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import logo from '../../assets/icon.png';

export function LoginPage({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Erro', 'Preencha todos os campos');
            return;
        }

        setLoading(true);
        try {
            await signIn(email, password);
        } catch (error) {
            Alert.alert('Erro', 'Falha no login. Verifique suas credenciais.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                    <View className="flex-1 justify-center px-8">
                        <View className="items-center mb-12">
                            <Image source={logo} className="h-20 w-20 mb-4 rounded-xl" /> 
                            <Text className="text-3xl font-bold text-[#7E1A8B]">Gestflow</Text>
                            <Text className="text-gray-500 mt-2 text-center">
                                Gerencie suas transações com simplicidade
                            </Text>
                        </View>

                        <View className="w-full space-y-4">
                            <Input
                                label="Email"
                                placeholder="exemplo@email.com"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                            
                            <Input
                                label="Senha"
                                placeholder="••••••••"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                rightElement={
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        {showPassword ? (
                                            <EyeOff size={20} color="#9CA3AF" />
                                        ) : (
                                            <Eye size={20} color="#9CA3AF" />
                                        )}
                                    </TouchableOpacity>
                                }
                            />

                            <Button 
                                title="Entrar" 
                                onPress={handleLogin} 
                                loading={loading}
                                className="mt-4 shadow-lg shadow-purple-200"
                            />

                            <Button 
                                title="Esqueceu a senha?" 
                                variant="ghost" 
                                onPress={() => navigation.navigate('ForgotPassword')}
                                className="mt-2"
                            />
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}