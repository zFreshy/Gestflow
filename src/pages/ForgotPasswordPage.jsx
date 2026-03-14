import React, { useState } from 'react';
import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/atoms/Input';
import { Button } from '../components/atoms/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';

export function ForgotPasswordPage({ navigation }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { resetPassword } = useAuth();

    const handleSubmit = async () => {
        if (!email) {
            Alert.alert('Erro', 'Por favor, informe seu e-mail.');
            return;
        }

        setLoading(true);
        try {
            await resetPassword(email);
            setSuccess(true);
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Falha ao enviar e-mail. Verifique se o endereço está correto.');
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
                    <View className="flex-1 px-8 pt-8">
                        <TouchableOpacity 
                            onPress={() => navigation.goBack()}
                            className="flex-row items-center mb-8"
                        >
                            <ArrowLeft size={24} color="#374151" />
                            <Text className="ml-2 text-gray-600 font-medium">Voltar para o login</Text>
                        </TouchableOpacity>

                        <View className="items-center mb-8">
                            <Text className="text-3xl font-bold text-[#7E1A8B] text-center mb-2">
                                Esqueceu a senha?
                            </Text>
                            <Text className="text-gray-500 text-center">
                                Digite seu e-mail para receber as instruções de redefinição.
                            </Text>
                        </View>

                        {success ? (
                            <View className="bg-green-50 border border-green-200 rounded-xl p-6 items-center">
                                <View className="h-12 w-12 bg-green-100 rounded-full items-center justify-center mb-4">
                                    <CheckCircle size={24} color="#16A34A" />
                                </View>
                                <Text className="text-lg font-bold text-green-900 mb-2">E-mail enviado!</Text>
                                <Text className="text-sm text-green-700 text-center mb-6">
                                    Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                                </Text>
                                <Button 
                                    title="Voltar para o login" 
                                    onPress={() => navigation.goBack()}
                                    className="w-full bg-white border border-green-200"
                                    textClassName="text-green-700"
                                />
                            </View>
                        ) : (
                            <View className="w-full space-y-4">
                                <Input
                                    label="Email"
                                    placeholder="exemplo@email.com"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />

                                <Button 
                                    title="Enviar link de recuperação" 
                                    onPress={handleSubmit} 
                                    loading={loading}
                                    className="mt-4 shadow-lg shadow-purple-200"
                                />
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}