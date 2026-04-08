import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Plus, Search, Trash2, Pencil, Building2, Package, TrendingDown, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { TransactionList } from '../organisms/TransactionList';

export function SuppliersPage({ transactions }) {
    const { user } = useAuth();
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [supplierName, setSupplierName] = useState('');
    const [historySupplier, setHistorySupplier] = useState(null);

    useEffect(() => {
        if (user) {
            fetchSuppliers();
        }
    }, [user]);

    const fetchSuppliers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setSuppliers(data || []);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            // Ignora o erro na UI para não travar a tela caso a tabela não exista ainda
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSupplier = async (e) => {
        e.preventDefault();
        if (!supplierName.trim()) return;

        try {
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
            fetchSuppliers();
        } catch (error) {
            console.error('Error saving supplier:', error);
            alert('Erro ao salvar fornecedor. Verifique se você já rodou o script SQL no Supabase.');
        }
    };

    const handleDeleteSupplier = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este fornecedor? Ele será removido das transações vinculadas.')) return;

        try {
            const { error } = await supabase
                .from('suppliers')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchSuppliers();
        } catch (error) {
            console.error('Error deleting supplier:', error);
            alert('Erro ao excluir fornecedor');
        }
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

    // Cálculos de estatísticas dos fornecedores
    const getSupplierStats = (supplierId) => {
        const supplierTxs = transactions.filter(t => t.supplier_id === supplierId);
        const totalSpent = supplierTxs.reduce((acc, curr) => acc + curr.amount, 0);
        return {
            purchaseCount: supplierTxs.length,
            totalSpent
        };
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
                    <p className="text-sm text-gray-500 mt-1">Gerencie seus fornecedores e veja o histórico de compras.</p>
                </div>
                <Button 
                    onClick={openCreateModal}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Novo Fornecedor
                </Button>
            </div>

            {/* Search and List */}
            <Card className="border-gray-100/80 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar fornecedor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white border-gray-200"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">Carregando fornecedores...</div>
                ) : filteredSuppliers.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-4">
                            <Building2 className="w-8 h-8 text-purple-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum fornecedor encontrado</h3>
                        <p className="text-gray-500 max-w-sm">
                            {searchTerm ? 'Tente buscar com outro nome.' : 'Cadastre seu primeiro fornecedor para começar a acompanhar as compras.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                        {filteredSuppliers.map(supplier => {
                            const stats = getSupplierStats(supplier.id);
                            return (
                                <div 
                                    key={supplier.id} 
                                    className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group relative cursor-pointer hover:border-purple-200"
                                    onClick={() => setHistorySupplier(supplier)}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                                <Building2 className="w-5 h-5" />
                                            </div>
                                            <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                                        </div>
                                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); openEditModal(supplier); }}
                                                className="p-1.5 text-gray-400 hover:text-purple-600 rounded-md hover:bg-purple-50 transition-colors"
                                                title="Editar Fornecedor"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteSupplier(supplier.id); }}
                                                className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors ml-1"
                                                title="Excluir Fornecedor"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                                <Package className="w-3 h-3" /> Compras
                                            </p>
                                            <p className="font-semibold text-gray-900">{stats.purchaseCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                                <TrendingDown className="w-3 h-3" /> Total Gasto
                                            </p>
                                            <p className="font-semibold text-red-600">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalSpent)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSaveSupplier} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Fornecedor</label>
                                <Input
                                    autoFocus
                                    value={supplierName}
                                    onChange={(e) => setSupplierName(e.target.value)}
                                    placeholder="Ex: Padeiro Distribuidora LTDA"
                                    required
                                />
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                                    Cancelar
                                </Button>
                                <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
                                    {editingSupplier ? 'Salvar' : 'Adicionar'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {historySupplier && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-purple-600" />
                                    Histórico: {historySupplier.name}
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">Todas as compras registradas para este fornecedor.</p>
                            </div>
                            <button 
                                onClick={() => setHistorySupplier(null)} 
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-0 md:p-6 overflow-y-auto flex-1 bg-gray-50/50 rounded-b-2xl">
                            <TransactionList 
                                transactions={transactions.filter(t => t.supplier_id === historySupplier.id)}
                                viewMode="month"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
