import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Plus, Search, Trash2, Pencil, Building2, Package, TrendingDown, X, AlertTriangle, ArrowRightLeft, Calculator, LineChart, CheckCircle } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'intelligence'

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
                    .insert([{ name: supplierName }]);

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

    // Inteligência: Radar de Fugas
    const getLeakRadar = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const parseDate = (dateStr) => {
            if (!dateStr) return new Date();
            const [d, m, y] = dateStr.split('/');
            return new Date(y, m - 1, d);
        };

        const supplierAnalytics = suppliers.map(sup => {
            const txs = transactions.filter(t => t.supplier_id === sup.id && t.type === 'expense');
            if (txs.length === 0) return null;

            // Agrupar por mês
            const monthlySpending = {};
            txs.forEach(t => {
                const date = parseDate(t.date);
                const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
                if (!monthlySpending[monthKey]) monthlySpending[monthKey] = 0;
                monthlySpending[monthKey] += t.amount;
            });

            const currentMonthKey = `${currentYear}-${currentMonth}`;
            const currentSpent = monthlySpending[currentMonthKey] || 0;

            // Calcular média histórica (excluindo mês atual)
            let totalPastSpent = 0;
            let pastMonthsCount = 0;
            
            Object.entries(monthlySpending).forEach(([key, amount]) => {
                if (key !== currentMonthKey) {
                    totalPastSpent += amount;
                    pastMonthsCount++;
                }
            });

            const historicalAverage = pastMonthsCount > 0 ? totalPastSpent / pastMonthsCount : 0;
            
            if (historicalAverage === 0 || currentSpent === 0) return null;

            const percentageIncrease = ((currentSpent - historicalAverage) / historicalAverage) * 100;

            return {
                supplier: sup,
                currentSpent,
                historicalAverage,
                percentageIncrease,
                isLeaking: percentageIncrease > 20 // Consideramos fuga se gastou 20% a mais que a média
            };
        }).filter(Boolean);

        return supplierAnalytics.filter(s => s.isLeaking).sort((a, b) => b.percentageIncrease - a.percentageIncrease);
    };

    // Inteligência: Comparador de Preços
    const getPriceComparisons = () => {
        const itemGroups = {};
        
        transactions.forEach(t => {
            if (t.type === 'expense' && t.supplier_id && t.description) {
                // Simplificação: agrupar por descrição exata (em caixa baixa)
                // Num sistema real, usaríamos um campo 'item_name' ou NLP
                const itemName = t.description.toLowerCase().trim();
                if (itemName.length < 3) return; // Ignorar descrições muito curtas

                if (!itemGroups[itemName]) {
                    itemGroups[itemName] = [];
                }
                
                const supplier = suppliers.find(s => s.id === t.supplier_id);
                if (supplier) {
                    itemGroups[itemName].push({
                        amount: t.amount,
                        date: t.date,
                        supplierName: supplier.name
                    });
                }
            }
        });

        // Filtrar apenas itens que foram comprados em mais de 1 fornecedor diferente
        const comparisons = [];
        Object.entries(itemGroups).forEach(([itemName, purchases]) => {
            const uniqueSuppliers = new Set(purchases.map(p => p.supplierName));
            if (uniqueSuppliers.size > 1) {
                // Encontrar o menor e maior preço para este item
                let minPurchase = purchases[0];
                let maxPurchase = purchases[0];

                purchases.forEach(p => {
                    if (p.amount < minPurchase.amount) minPurchase = p;
                    if (p.amount > maxPurchase.amount) maxPurchase = p;
                });

                // Só mostrar se houver uma diferença de preço
                if (minPurchase.amount < maxPurchase.amount) {
                    comparisons.push({
                        itemName,
                        minPurchase,
                        maxPurchase,
                        difference: maxPurchase.amount - minPurchase.amount,
                        percentageDiff: ((maxPurchase.amount - minPurchase.amount) / minPurchase.amount) * 100,
                        purchases: purchases.sort((a, b) => new Date(b.date.split('/').reverse().join('-')) - new Date(a.date.split('/').reverse().join('-')))
                    });
                }
            }
        });

        return comparisons.sort((a, b) => b.percentageDiff - a.percentageDiff);
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex bg-gray-200/60 p-1 rounded-lg self-start">
                            <button
                                onClick={() => setActiveTab('list')}
                                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                                    activeTab === 'list' 
                                    ? 'bg-white text-gray-900 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Todos os Fornecedores
                            </button>
                            <button
                                onClick={() => setActiveTab('intelligence')}
                                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
                                    activeTab === 'intelligence' 
                                    ? 'bg-white text-purple-700 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <TrendingDown className="w-4 h-4" />
                                Inteligência
                            </button>
                        </div>
                        {activeTab === 'list' && (
                            <div className="relative max-w-md w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Buscar fornecedor..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-white border-gray-200"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">Carregando fornecedores...</div>
                ) : activeTab === 'list' ? (
                    filteredSuppliers.length === 0 ? (
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
                    )
                ) : (
                    <div className="p-6 bg-white space-y-8">
                        {/* Seção 1: Radar de Fugas */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                                <AlertTriangle className="w-5 h-5 text-rose-500" />
                                Radar de Fugas
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Fornecedores onde você gastou neste mês <strong className="text-rose-600">20% a mais</strong> do que sua média histórica.
                            </p>
                            
                            {getLeakRadar().length === 0 ? (
                                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-100 flex items-center gap-3">
                                    <CheckCircle className="w-5 h-5" />
                                    <p className="text-sm font-medium">Tudo sob controle! Nenhum aumento alarmante detectado neste mês.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {getLeakRadar().map(leak => (
                                        <div key={leak.supplier.id} className="bg-rose-50 border border-rose-100 p-4 rounded-xl">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-rose-900">{leak.supplier.name}</h4>
                                                <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-md">
                                                    +{leak.percentageIncrease.toFixed(0)}% acima da média
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm mt-3">
                                                <div>
                                                    <p className="text-rose-700/70 text-xs uppercase font-bold">Gasto este mês</p>
                                                    <p className="font-black text-rose-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(leak.currentSpent)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-rose-700/70 text-xs uppercase font-bold">Média histórica</p>
                                                    <p className="font-bold text-rose-900/60">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(leak.historicalAverage)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <hr className="border-gray-100" />

                        {/* Seção 2: Comparador de Preços */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                                <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                                Comparador de Preços Automático
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Produtos/Descrições idênticas que você comprou em fornecedores diferentes.
                            </p>

                            {getPriceComparisons().length === 0 ? (
                                <div className="bg-blue-50 text-blue-700 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                                    <LineChart className="w-5 h-5" />
                                    <p className="text-sm font-medium">Você ainda não tem descrições exatas compradas em fornecedores diferentes para compararmos.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {getPriceComparisons().map((comp, idx) => (
                                        <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                                <div>
                                                    <h4 className="font-bold text-gray-900 capitalize">{comp.itemName}</h4>
                                                    <p className="text-xs text-gray-500 mt-0.5">Diferença encontrada: <strong className="text-emerald-600">{comp.percentageDiff.toFixed(1)}% mais barato</strong> no fornecedor mais em conta.</p>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="bg-emerald-50 border border-emerald-100 p-2 px-3 rounded-lg text-center">
                                                        <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Mais Barato</p>
                                                        <p className="font-bold text-emerald-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(comp.minPurchase.amount)}</p>
                                                        <p className="text-xs text-emerald-600/70 truncate w-24" title={comp.minPurchase.supplierName}>{comp.minPurchase.supplierName}</p>
                                                    </div>
                                                    <div className="bg-rose-50 border border-rose-100 p-2 px-3 rounded-lg text-center">
                                                        <p className="text-[10px] uppercase font-bold text-rose-600 mb-1">Mais Caro</p>
                                                        <p className="font-bold text-rose-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(comp.maxPurchase.amount)}</p>
                                                        <p className="text-xs text-rose-600/70 truncate w-24" title={comp.maxPurchase.supplierName}>{comp.maxPurchase.supplierName}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
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
