import React, { useState, useEffect, useMemo } from 'react';
import { X, Calculator, Plus, Trash2, TrendingUp, TrendingDown, Wand2, DollarSign } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';

export function ScenarioSimulatorModal({ isOpen, onClose, stats }) {
    const [customDailyIncome, setCustomDailyIncome] = useState('');
    const [simulatedExpenses, setSimulatedExpenses] = useState([]);
    const [newExpenseDesc, setNewExpenseDesc] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');

    useEffect(() => {
        if (isOpen && stats) {
            setCustomDailyIncome(stats.currentDailyAverage.toFixed(2));
            setSimulatedExpenses([]);
            setNewExpenseDesc('');
            setNewExpenseAmount('');
        }
    }, [isOpen, stats]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const handleAddExpense = (e) => {
        e.preventDefault();
        if (!newExpenseDesc || !newExpenseAmount) return;
        
        setSimulatedExpenses([...simulatedExpenses, {
            id: crypto.randomUUID(),
            description: newExpenseDesc,
            amount: parseFloat(newExpenseAmount.replace(',', '.'))
        }]);
        setNewExpenseDesc('');
        setNewExpenseAmount('');
    };

    const removeExpense = (id) => {
        setSimulatedExpenses(simulatedExpenses.filter(e => e.id !== id));
    };

    const results = useMemo(() => {
        if (!stats) return null;

        const additionalExpenses = simulatedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
        const totalProjectedExpenses = stats.totalExpensesForecast + additionalExpenses;
        
        let newIncomeNeeded = totalProjectedExpenses - stats.totalIncomeReal;
        if (newIncomeNeeded < 0) newIncomeNeeded = 0;

        const newDailyGoal = newIncomeNeeded / stats.remainingDays;
        const newMonthlyGoal = newDailyGoal * 30;

        // Projeção de Saldo
        const dailyIncomeValue = parseFloat(customDailyIncome?.toString().replace(',', '.') || 0);
        const projectedIncome = stats.totalIncomeReal + (dailyIncomeValue * stats.remainingDays);
        const finalBalance = projectedIncome - totalProjectedExpenses;

        return {
            totalProjectedExpenses,
            newIncomeNeeded,
            newDailyGoal,
            newMonthlyGoal,
            projectedIncome,
            finalBalance,
            dailyIncomeValue
        };
    }, [stats, simulatedExpenses, customDailyIncome]);

    if (!isOpen || !stats) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content bg-card rounded-2xl shadow-2xl border w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b shrink-0 bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                            <Wand2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Simulador de Cenários</h2>
                            <p className="text-sm text-gray-500 font-medium">Faça projeções e planeje novas despesas</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white/50 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* Coluna Esquerda: Entradas e Projeção */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                    Projeção de Faturamento
                                </h3>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                                            Média Diária de Faturamento Projetada (R$)
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</div>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={customDailyIncome}
                                                onChange={(e) => setCustomDailyIncome(e.target.value)}
                                                className="pl-10 font-semibold text-gray-900"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            * Pré-preenchido com sua média real atual. Altere para simular um faturamento maior ou menor nos próximos {stats.remainingDays} dias.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Resultados da Projeção */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-4 bg-gray-50 border-b border-gray-100">
                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                                        Resultado Projetado
                                    </h4>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600 font-medium">Faturamento Estimado Total</span>
                                        <span className="font-bold text-emerald-600">{formatCurrency(results.projectedIncome)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600 font-medium">Saídas Totais Projetadas</span>
                                        <span className="font-bold text-rose-600">-{formatCurrency(results.totalProjectedExpenses)}</span>
                                    </div>
                                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                                        <span className="text-sm font-bold text-gray-900">Saldo Final Previsto</span>
                                        <span className={`text-xl font-black ${results.finalBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {results.finalBalance >= 0 ? '+' : ''}{formatCurrency(results.finalBalance)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Coluna Direita: Simulação de Despesas */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Calculator className="w-4 h-4 text-purple-500" />
                                    Simular Novas Despesas
                                </h3>
                                
                                <form onSubmit={handleAddExpense} className="flex gap-2 mb-4">
                                    <div className="flex-1">
                                        <Input
                                            placeholder="Ex: Compra de Equipamento"
                                            value={newExpenseDesc}
                                            onChange={(e) => setNewExpenseDesc(e.target.value)}
                                        />
                                    </div>
                                    <div className="w-32">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="Valor"
                                            value={newExpenseAmount}
                                            onChange={(e) => setNewExpenseAmount(e.target.value)}
                                        />
                                    </div>
                                    <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-3">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </form>

                                {/* Lista de despesas simuladas */}
                                {simulatedExpenses.length > 0 && (
                                    <div className="bg-purple-50/50 rounded-xl border border-purple-100 p-2 space-y-2 mb-6">
                                        {simulatedExpenses.map(expense => (
                                            <div key={expense.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-purple-50 shadow-sm">
                                                <span className="text-sm font-medium text-gray-700">{expense.description}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-bold text-rose-600">-{formatCurrency(expense.amount)}</span>
                                                    <button onClick={() => removeExpense(expense.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Impacto nas Metas */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                                    <h4 className="text-sm font-bold text-purple-900 uppercase tracking-wider">
                                        Impacto no Plano de Ação
                                    </h4>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                        <span className="text-sm text-gray-600 font-medium">Nova Meta Diária</span>
                                        <div className="text-right">
                                            <span className="font-black text-blue-600 block text-lg">{formatCurrency(results.newDailyGoal)}</span>
                                            {results.newDailyGoal > stats.dailyAverageNeeded && (
                                                <span className="text-xs font-bold text-rose-500">+{formatCurrency(results.newDailyGoal - stats.dailyAverageNeeded)}/dia</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                        <span className="text-sm text-gray-600 font-medium">Nova Meta Mensal</span>
                                        <div className="text-right">
                                            <span className="font-black text-indigo-600 block text-lg">{formatCurrency(results.newMonthlyGoal)}</span>
                                            {results.newMonthlyGoal > stats.monthlyAverageNeeded && (
                                                <span className="text-xs font-bold text-rose-500">+{formatCurrency(results.newMonthlyGoal - stats.monthlyAverageNeeded)}/mês</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
