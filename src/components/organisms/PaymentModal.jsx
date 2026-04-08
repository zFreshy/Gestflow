import React, { useState } from 'react';
import { X, Calendar, DollarSign } from 'lucide-react';
import { Input } from '../atoms/Input';
import { Button } from '../atoms/Button';
import { FormField } from '../molecules/FormField';

export function PaymentModal({ transaction, onClose, onConfirm }) {
    // Helper to get local date in YYYY-MM-DD format
    const getToday = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayStr = getToday();
    const [paymentDate, setPaymentDate] = useState(todayStr);
    const [interestAmount, setInterestAmount] = useState('');
    const [useToday, setUseToday] = useState(true);
    const [actualAmount, setActualAmount] = useState(transaction?.amount || '');

    // Se o amount original for 0, sabemos que é "A Definir"
    const isAmountTBD = transaction?.amount === 0;

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (isAmountTBD && (!actualAmount || parseFloat(actualAmount) <= 0)) {
            alert('Por favor, informe o valor pago.');
            return;
        }
        
        // Format date to DD/MM/YYYY
        const [year, month, day] = paymentDate.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        
        const interest = interestAmount ? parseFloat(interestAmount) : 0;
        const finalAmountValue = actualAmount ? parseFloat(actualAmount) : transaction.amount;
        
        onConfirm(transaction.id, 'Pago', formattedDate, interest, finalAmountValue);
        onClose();
    };

    const handleDateChange = (e) => {
        setPaymentDate(e.target.value);
        setUseToday(e.target.value === getToday());
    };

    const setToday = () => {
        setPaymentDate(getToday());
        setUseToday(true);
    };

    if (!transaction) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4 overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Confirmar Pagamento</h3>
                        <p className="text-sm text-gray-500">{transaction.description}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Final Amount Input (if TBD or optionally to change it) */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700 block">
                            {isAmountTBD ? 'Valor da Despesa (A definir)' : 'Valor da Despesa'}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={actualAmount}
                                onChange={(e) => setActualAmount(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-gray-900 font-medium"
                                placeholder={isAmountTBD ? "0,00" : transaction.amount.toFixed(2)}
                                required={isAmountTBD}
                            />
                        </div>
                        {isAmountTBD && (
                            <p className="text-xs text-amber-600">
                                Esta despesa estava marcada como "A definir". Por favor, informe o valor pago.
                            </p>
                        )}
                    </div>

                    {/* Interest Amount */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            Houve juros? <span className="text-gray-400 font-normal text-xs">(Opcional)</span>
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                placeholder="0,00" 
                                className="pl-9"
                                value={interestAmount}
                                onChange={(e) => setInterestAmount(e.target.value)}
                            />
                        </div>
                        {interestAmount > 0 && (
                            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                                O valor da despesa será atualizado para: 
                                <span className="font-bold ml-1">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.amount + parseFloat(interestAmount))}
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="h-4 w-4" />
                            Confirmar Pagamento
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CheckCircle({ className }) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    );
}