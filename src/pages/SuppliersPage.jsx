import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { transactionService } from '../services/transactionService';
import { supabase } from '../lib/supabase';
import { Building2, Search, Plus, Pencil, Trash2, Package, TrendingDown, X, ChevronLeft } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils';
import { TransactionItem } from '../components/molecules/TransactionItem';

export function SuppliersPage({ navigation }) {
    const { user } = useAuth();
    const [suppliers, setSuppliers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [supplierName, setSupplierName] = useState('');
    const [historySupplier, setHistorySupplier] = useState(null);

    const fetchData = async () => {
        try {
            // Fetch Suppliers
            const { data: suppData, error: suppError } = await supabase
                .from('suppliers')
                .select('*')
                .order('name', { ascending: true });

            if (suppError) throw suppError;
            setSuppliers(suppData || []);

            // Fetch Transactions for stats
            const txResponse = await transactionService.getAll(user.id, 0, 1000, true);
            let dataToMap = [];
            if (Array.isArray(txResponse)) {
                dataToMap = txResponse;
            } else if (txResponse && Array.isArray(txResponse.data)) {
                dataToMap = txResponse.data;
            }
            setTransactions(dataToMap);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [user])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleSaveSupplier = async () => {
        if (!supplierName.trim()) return;

        try {
            setLoading(true);
            if (editingSupplier) {
                const { error } = await supabase
                    .from('suppliers')
                    .update({ name: supplierName })
                    .eq('id', editingSupplier.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('suppliers')
                    .insert([{ name: supplierName, user_id: user.id }]);
                if (error) throw error;
            }

            setSupplierName('');
            setEditingSupplier(null);
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error('Error saving supplier:', error);
            Alert.alert('Erro', 'Erro ao salvar fornecedor.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSupplier = (id) => {
        Alert.alert(
            'Excluir Fornecedor',
            'Tem certeza que deseja excluir este fornecedor?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { 
                    text: 'Excluir', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const { error } = await supabase
                                .from('suppliers')
                                .delete()
                                .eq('id', id);
                            if (error) throw error;
                            fetchData();
                        } catch (error) {
                            console.error('Error deleting supplier:', error);
                            Alert.alert('Erro', 'Erro ao excluir fornecedor');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const openEditModal = (supplier) => {
        setEditingSupplier(supplier);
        setSupplierName(supplier.name);
        setIsModalOpen(true);
    };

    const openCreateModal = () => {
        setEditingSupplier(null);
        setSupplierName('');
        setIsModalOpen(true);
    };

    const filteredSuppliers = suppliers.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getSupplierStats = (supplierId) => {
        const supplierTxs = transactions.filter(t => t.supplier_id === supplierId);
        const totalSpent = supplierTxs.reduce((acc, curr) => acc + curr.amount, 0);
        return {
            purchaseCount: supplierTxs.length,
            totalSpent
        };
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="px-6 pt-4 pb-2 bg-white flex-row items-center border-b border-gray-100">
                <TouchableOpacity 
                    onPress={() => navigation.goBack()} 
                    className="p-2 -ml-2 mr-2"
                >
                    <ChevronLeft size={24} color="#374151" />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-xl font-bold text-gray-900">Fornecedores</Text>
                </View>
                <TouchableOpacity 
                    onPress={openCreateModal}
                    className="bg-purple-600 p-2 rounded-xl shadow-sm flex-row items-center"
                >
                    <Plus size={20} color="white" />
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View className="px-6 py-4 bg-white border-b border-gray-100">
                <View className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                    <Search size={20} color="#9CA3AF" />
                    <TextInput 
                        placeholder="Buscar fornecedor..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        className="flex-1 ml-3 text-base text-gray-900"
                        placeholderTextColor="#9CA3AF"
                    />
                    {searchTerm ? (
                        <TouchableOpacity onPress={() => setSearchTerm('')}>
                            <X size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {/* List */}
            <ScrollView 
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7E1A8B"]} tintColor="#7E1A8B" />
                }
            >
                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color="#7E1A8B" className="mt-8" />
                ) : filteredSuppliers.length === 0 ? (
                    <View className="items-center justify-center py-12">
                        <View className="w-16 h-16 bg-purple-50 rounded-full items-center justify-center mb-4">
                            <Building2 size={32} color="#C084FC" />
                        </View>
                        <Text className="text-lg font-bold text-gray-900 mb-2">Nenhum fornecedor</Text>
                        <Text className="text-gray-500 text-center px-8">
                            {searchTerm ? 'Tente buscar com outro nome.' : 'Cadastre seu primeiro fornecedor para acompanhar as compras.'}
                        </Text>
                    </View>
                ) : (
                    <View className="space-y-4">
                        {filteredSuppliers.map(supplier => {
                            const stats = getSupplierStats(supplier.id);
                            return (
                                <TouchableOpacity 
                                    key={supplier.id}
                                    onPress={() => setHistorySupplier(supplier)}
                                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm"
                                >
                                    <View className="flex-row justify-between items-start mb-4">
                                        <View className="flex-row items-center flex-1 pr-4">
                                            <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-3">
                                                <Building2 size={20} color="#7E1A8B" />
                                            </View>
                                            <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>{supplier.name}</Text>
                                        </View>
                                        <View className="flex-row items-center gap-2">
                                            <TouchableOpacity 
                                                onPress={() => openEditModal(supplier)}
                                                className="p-2 bg-gray-50 rounded-lg"
                                            >
                                                <Pencil size={16} color="#6B7280" />
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                onPress={() => handleDeleteSupplier(supplier.id)}
                                                className="p-2 bg-red-50 rounded-lg"
                                            >
                                                <Trash2 size={16} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View className="flex-row justify-between border-t border-gray-50 pt-4 mt-1">
                                        <View>
                                            <View className="flex-row items-center mb-1">
                                                <Package size={14} color="#6B7280" />
                                                <Text className="text-xs text-gray-500 ml-1">Compras</Text>
                                            </View>
                                            <Text className="text-sm font-bold text-gray-900">{stats.purchaseCount}</Text>
                                        </View>
                                        <View className="items-end">
                                            <View className="flex-row items-center mb-1">
                                                <TrendingDown size={14} color="#6B7280" />
                                                <Text className="text-xs text-gray-500 ml-1">Total Gasto</Text>
                                            </View>
                                            <Text className="text-sm font-bold text-red-600">{formatCurrency(stats.totalSpent)}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Create/Edit Modal */}
            <Modal
                visible={isModalOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsModalOpen(false)}
            >
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white rounded-t-3xl p-6 min-h-[40%]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold text-gray-900">
                                {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                            </Text>
                            <TouchableOpacity onPress={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full">
                                <X size={20} color="#374151" />
                            </TouchableOpacity>
                        </View>

                        <View className="space-y-4">
                            <View>
                                <Text className="text-sm font-medium text-gray-700 mb-2">Nome do Fornecedor</Text>
                                <TextInput
                                    value={supplierName}
                                    onChangeText={setSupplierName}
                                    placeholder="Ex: Padeiro da Esquina"
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                                />
                            </View>

                            <TouchableOpacity 
                                onPress={handleSaveSupplier}
                                disabled={!supplierName.trim() || loading}
                                className={`py-4 rounded-xl items-center mt-4 ${!supplierName.trim() || loading ? 'bg-purple-300' : 'bg-purple-600'}`}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold text-base">Salvar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* History Modal */}
            <Modal
                visible={!!historySupplier}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setHistorySupplier(null)}
            >
                <View className="flex-1 bg-white mt-12 rounded-t-3xl overflow-hidden shadow-2xl">
                    <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between bg-white z-10">
                        <View className="flex-1">
                            <Text className="text-lg font-bold text-gray-900 flex-row items-center">
                                Histórico: {historySupplier?.name}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setHistorySupplier(null)} className="p-2 bg-gray-100 rounded-full ml-2">
                            <X size={20} color="#374151" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        {historySupplier && transactions.filter(t => t.supplier_id === historySupplier.id).length > 0 ? (
                            transactions.filter(t => t.supplier_id === historySupplier.id).map(t => (
                                <View key={t.id} className="mb-3">
                                    <TransactionItem 
                                        transaction={t} 
                                        showDate={true}
                                        onPress={() => {
                                            setHistorySupplier(null);
                                            navigation.navigate('AddTransaction', { transaction: t });
                                        }} 
                                    />
                                </View>
                            ))
                        ) : (
                            <View className="items-center py-10">
                                <Text className="text-gray-500">Nenhuma compra registrada.</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}