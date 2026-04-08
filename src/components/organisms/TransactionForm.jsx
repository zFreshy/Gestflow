import React, { useState, useEffect } from 'react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from '../molecules/FormField';
import { X, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function TransactionForm({ onAddTransaction, onEditTransaction, isOpen, onClose, initialData }) {
    // Helper to get local date in YYYY-MM-DD format
    const getToday = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [activeTab, setActiveTab] = useState('income');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('pix');
    const [date, setDate] = useState(getToday());
    
    // Income specific states
    const [isBakeryIncome, setIsBakeryIncome] = useState(false);
    const [clientName, setClientName] = useState('');
    
    // Expense specific states
    const [expenseType, setExpenseType] = useState('fixed');
    const [recurrence, setRecurrence] = useState('monthly');
    const [interestRate, setInterestRate] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [endDate, setEndDate] = useState(''); // New state for end date
    const [installments, setInstallments] = useState(''); // New state for installments
    const [isAmountTBD, setIsAmountTBD] = useState(false); // Novo estado
    
    // Supplier specific states
    const [supplierId, setSupplierId] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    
    // Planned specific states
    const [plannedEntries, setPlannedEntries] = useState([{ dateStr: '', amount: '' }]);

    const addPlannedEntry = () => {
        setPlannedEntries([...plannedEntries, { dateStr: '', amount: '' }]);
    };

    const removePlannedEntry = (index) => {
        setPlannedEntries(plannedEntries.filter((_, i) => i !== index));
    };

    const updatePlannedEntry = (index, field, value) => {
        const newEntries = [...plannedEntries];
        newEntries[index][field] = value;
        setPlannedEntries(newEntries);
    };

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const { data } = await supabase.from('suppliers').select('*').order('name');
                if (data) setSuppliers(data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchSuppliers();
    }, []);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Edit mode: Populate form with initialData
                // Check if it's a supplier transaction
                if (initialData.type === 'expense' && (initialData.supplier_id || initialData.expenseType === 'supplier' || initialData.expense_type === 'supplier')) {
                    setActiveTab('supplier');
                    setSupplierId(initialData.supplier_id || '');
                } else {
                    setActiveTab(initialData.type);
                }
                
                setDescription(initialData.description);
                
                // Lógica para carregar o valor "a definir" se for 0
                if (initialData.type === 'expense' && initialData.amount === 0) {
                    setIsAmountTBD(true);
                    setAmount('');
                } else {
                    setAmount(initialData.amount.toString());
                    setIsAmountTBD(false);
                }
                
                setPaymentMethod(initialData.paymentMethod || initialData.payment_method);
                
                // Convert DD/MM/YYYY back to YYYY-MM-DD for input[type="date"]
                const [day, month, year] = initialData.date.split('/');
                setDate(`${year}-${month}-${day}`);

                if (initialData.type === 'income') {
                    setIsBakeryIncome(initialData.isBakeryIncome || initialData.is_bakery_income || false);
                    setClientName(initialData.clientName || initialData.client_name || '');
                } else {
                    setExpenseType(initialData.expenseType || initialData.expense_type || 'fixed');
                    if ((initialData.expenseType || initialData.expense_type) === 'fixed') {
                        setRecurrence(initialData.recurrence || 'monthly');
                        setInterestRate(initialData.interestRate || initialData.interest_rate || '');
                        setIsActive(initialData.active !== false); 
                        setEndDate(initialData.end_date || ''); // Populate end_date
                        setInstallments(initialData.installments || ''); // Populate installments
                    }
                }
            } else {
                // Add mode: Reset form
                setActiveTab('income');
                setDescription('');
                setAmount('');
                setPaymentMethod('pix');
                setDate(getToday());
                setIsBakeryIncome(false);
                setClientName('');
                setExpenseType('fixed');
                setRecurrence('monthly');
                setInterestRate('');
                setIsActive(true);
                setEndDate('');
                setInstallments('');
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (activeTab === 'expense' && expenseType === 'planned' && !initialData) {
            if (!description || plannedEntries.length === 0) return;
            const isValid = plannedEntries.every(e => e.dateStr && e.amount);
            if (!isValid) {
                alert('Preencha todas as datas e valores planejados.');
                return;
            }
        } else if (activeTab === 'supplier') {
            if (!supplierId || !amount || !date) return;
        } else {
            if (!description || (!amount && !isAmountTBD) || !date) return;
        }

        // Convert YYYY-MM-DD to DD/MM/YYYY
        const [year, month, day] = date.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        const timestamp = new Date(year, month - 1, day).getTime();

        let finalType = activeTab;
        let finalExpenseType = expenseType;
        
        if (activeTab === 'supplier') {
            finalType = 'expense';
            finalExpenseType = 'variable'; // Define como 'variable' para evitar erro de constraint no banco
        }

        const transaction = {
            id: initialData ? initialData.id : crypto.randomUUID(),
            description,
            amount: isAmountTBD ? 0 : parseFloat(amount || 0),
            type: finalType, // 'income' or 'expense'
            paymentMethod,
            date: formattedDate,
            timestamp: timestamp,
            supplier_id: activeTab === 'supplier' ? supplierId : null
        };

        if (finalType === 'income') {
            if (isBakeryIncome) {
                transaction.isBakeryIncome = true;
                transaction.clientName = clientName;
            } else {
                transaction.isBakeryIncome = false;
                transaction.clientName = null;
            }
        } else {
            transaction.expenseType = finalExpenseType;
            if (finalExpenseType === 'fixed') {
                transaction.recurrence = recurrence;
                transaction.active = isActive;
                transaction.end_date = !isActive && endDate ? endDate : null;
                if (interestRate) {
                    transaction.interestRate = parseFloat(interestRate);
                } else {
                    transaction.interestRate = null;
                }
                if (installments && parseInt(installments) > 1 && !initialData) {
                    transaction.installments = parseInt(installments);
                }
            } else if (finalExpenseType === 'planned' && !initialData) {
                transaction.plannedEntries = plannedEntries;
            } else {
                transaction.recurrence = null;
                transaction.active = null;
                transaction.end_date = null;
                transaction.interestRate = null;
                transaction.installments = null;
            }
        }

        if (initialData && onEditTransaction) {
            onEditTransaction(transaction);
        } else {
            onAddTransaction(transaction);
        }
        
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content bg-card rounded-2xl shadow-2xl border w-full max-w-md mx-4 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 pb-2 shrink-0">
                    <h2 className="text-lg font-semibold">Nova Transação</h2>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-100 p-1.5 mx-6 mt-4 rounded-xl gap-1 shrink-0 overflow-x-auto">
                    {[
                        { id: 'expense', label: 'Despesa' },
                        { id: 'income', label: 'Lucro' },
                        { id: 'supplier', label: 'Fornecedor' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? tab.id === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 
                                      tab.id === 'supplier' ? 'bg-blue-600 text-white shadow-sm' : 'bg-red-500 text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    
                    {/* Common Fields */}
                    {activeTab === 'supplier' && (
                        <FormField label="Fornecedor">
                            <Select
                                value={supplierId}
                                onChange={(e) => {
                                    setSupplierId(e.target.value);
                                    const supp = suppliers.find(s => s.id === e.target.value);
                                    if (supp) setDescription(`Compra: ${supp.name}`);
                                }}
                                required
                            >
                                <option value="" disabled>Selecione um fornecedor</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </Select>
                        </FormField>
                    )}
                    <FormField label={activeTab === 'supplier' ? 'Descrição / Itens (Opcional)' : 'Descrição'}>
                        <Input
                            placeholder={activeTab === 'supplier' ? 'Ex: 10 sacos de farinha' : activeTab === 'income' ? "Ex: Venda de Produto" : "Ex: Conta de Luz"}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required={activeTab !== 'supplier'}
                        />
                    </FormField>

                    {!(activeTab === 'expense' && expenseType === 'planned' && !initialData) && (
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Valor (R$)">
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required={!isAmountTBD}
                                    disabled={isAmountTBD}
                                />
                                {activeTab === 'expense' && expenseType === 'fixed' && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <input
                                            type="checkbox"
                                            id="isAmountTBD"
                                            checked={isAmountTBD}
                                            onChange={(e) => {
                                                setIsAmountTBD(e.target.checked);
                                                if (e.target.checked) setAmount('');
                                            }}
                                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                        />
                                        <label htmlFor="isAmountTBD" className="text-sm font-medium text-gray-700">
                                            Valor a definir
                                        </label>
                                    </div>
                                )}
                            </FormField>

                            <FormField label="Data">
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                />
                            </FormField>
                        </div>
                    )}

                    <FormField label="Método de Pagamento">
                        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                            <option value="pix">PIX</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="cartao">Cartão de Crédito</option>
                            <option value="debito">Cartão de Débito</option>
                            <option value="credito_loja">Crédito Loja (fiado)</option>
                            <option value="vale_alimentacao">Vale Alimentação</option>
                            <option value="vale_combustivel">Vale Combustível</option>
                            <option value="diversos">Diversos</option>
                        </Select>
                    </FormField>

                    {/* Income Specific Fields */}
                    {activeTab === 'income' && (
                        <div className="space-y-4 pt-2 border-t">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="bakery-income"
                                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    checked={isBakeryIncome}
                                    onChange={(e) => setIsBakeryIncome(e.target.checked)}
                                />
                                <label htmlFor="bakery-income" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Lucro da padaria
                                </label>
                            </div>

                            {isBakeryIncome && (
                                <FormField label="Nome do Cliente">
                                    <Input
                                        placeholder="Ex: João da Silva"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                    />
                                </FormField>
                            )}
                        </div>
                    )}

                    {/* Expense Specific Fields */}
                    {activeTab === 'expense' && (
                        <div className="space-y-4 pt-2 border-t">
                            <FormField label="Tipo de Despesa">
                                <div className="flex gap-4">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="expenseType"
                                            value="fixed"
                                            checked={expenseType === 'fixed'}
                                            onChange={(e) => setExpenseType(e.target.value)}
                                            className="h-4 w-4 border-gray-300 text-red-600 focus:ring-red-500"
                                        />
                                        <span className="text-sm">Fixa</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="expenseType"
                                            value="variable"
                                            checked={expenseType === 'variable'}
                                            onChange={(e) => setExpenseType(e.target.value)}
                                            className="h-4 w-4 border-gray-300 text-red-600 focus:ring-red-500"
                                        />
                                        <span className="text-sm">Variável</span>
                                    </label>
                                    {!initialData && (
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="expenseType"
                                                value="planned"
                                                checked={expenseType === 'planned'}
                                                onChange={(e) => setExpenseType(e.target.value)}
                                                className="h-4 w-4 border-gray-300 text-red-600 focus:ring-red-500"
                                            />
                                            <span className="text-sm">Planejada</span>
                                        </label>
                                    )}
                                </div>
                            </FormField>

                            {expenseType === 'planned' && !initialData && (
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-gray-700">Datas e Valores</label>
                                        {plannedEntries.map((entry, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <Input 
                                                    type="date" 
                                                    value={entry.dateStr} 
                                                    onChange={(e) => updatePlannedEntry(idx, 'dateStr', e.target.value)} 
                                                    required 
                                                    className="flex-1"
                                                />
                                                <div className="relative flex-1">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                                                    <Input 
                                                        type="number" 
                                                        step="0.01"
                                                        min="0.01"
                                                        placeholder="0.00" 
                                                        value={entry.amount} 
                                                        onChange={(e) => updatePlannedEntry(idx, 'amount', e.target.value)} 
                                                        required 
                                                        className="pl-8"
                                                    />
                                                </div>
                                                {plannedEntries.length > 1 && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removePlannedEntry(idx)} 
                                                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors shrink-0"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button 
                                            type="button" 
                                            onClick={addPlannedEntry} 
                                            className="text-sm text-blue-600 font-medium hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors inline-block"
                                        >
                                            + Adicionar nova data
                                        </button>
                                    </div>
                                </div>
                            )}

                            {expenseType === 'fixed' && (
                                <>
                                    <FormField label="Recorrência">
                                        <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                                            <option value="daily">Diária</option>
                                            <option value="weekly">Semanal</option>
                                            <option value="monthly">Mensal</option>
                                            <option value="quarterly">Trimestral</option>
                                            <option value="semiannual">Semestral</option>
                                            <option value="annual">Anual</option>
                                            <option value="biennial">Bienal</option>
                                        </Select>
                                    </FormField>

                                    <FormField label="Taxa de Juros (%) - Opcional">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={interestRate}
                                            onChange={(e) => setInterestRate(e.target.value)}
                                        />
                                    </FormField>

                                    {!initialData && (
                                        <FormField label="Parcelas (Opcional)">
                                            <Input
                                                type="number"
                                                min="1"
                                                placeholder="Ex: 3"
                                                value={installments}
                                                onChange={(e) => setInstallments(e.target.value)}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Se preenchido, o valor acima será dividido por este número de parcelas.
                                            </p>
                                        </FormField>
                                    )}

                                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={!isActive}
                            onChange={(e) => {
                                setIsActive(!e.target.checked);
                                if (e.target.checked) {
                                    // Default to current date if enabling finalization
                                    setEndDate(new Date().toISOString().split('T')[0]);
                                } else {
                                    setEndDate('');
                                }
                            }}
                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                            Despesa Finalizada
                        </label>
                    </div>

                    {!isActive && (
                        <div className="mt-2 pl-6">
                            <FormField label="Finalizada em (Mês/Data)">
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    required={!isActive}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    A partir desta data, não serão geradas novas cobranças.
                                </p>
                            </FormField>
                        </div>
                    )}
                    </>
                )}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-10 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={`flex-1 h-10 rounded-xl text-white text-sm font-medium shadow-sm transition-colors ${
                                activeTab === 'income' 
                                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                                    : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                            {initialData ? 'Salvar Alterações' : (activeTab === 'income' ? 'Adicionar Lucro' : 'Adicionar Despesa')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
